<?php

namespace App\Notifications;

use App\Models\ConsumableRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ConsumableRequestNotification extends Notification
{
    use Queueable;

    public $requests;

    public function __construct($requests)
    {
        // Handle both single model or collection/array
        $this->requests = is_array($requests) || $requests instanceof \Illuminate\Support\Collection
            ? collect($requests)
            : collect([$requests]);
    }

    public function via(object $notifiable): array
    {
        $channels = [];
        if (Schema::hasTable('notifications')) {
            $channels[] = 'database';
        }

        $channels[] = 'mail';
        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $firstRequest = $this->requests->first();
        if (!$firstRequest) return (new MailMessage)->line("Erreur de notification.");

        $user = $firstRequest->user;
        $status = Str::lower($firstRequest->status);
        $isOwner = $notifiable->id === $firstRequest->user_id;
        $isStockManagerRecipient = $notifiable->hasRole(['responsable de stock', 'responsable', 'agent de stock', 'agent'])
            || in_array(strtolower((string) ($notifiable->role ?? '')), ['responsable de stock', 'responsable', 'agent de stock', 'agent']);

        // Detecter si c'est une approbation partielle (mélange d'approuvés et de rejetés)
        $approvedCount = $this->requests->filter(fn($r) => in_array(Str::lower($r->status), ['approved_pending_exit', 'validated_by_manager', 'approved']))->count();
        $rejectedCount = $this->requests->filter(fn($r) => Str::lower($r->status) === 'rejected')->count();
        $isPartialApproval = $approvedCount > 0 && $rejectedCount > 0;

        $isApproval = in_array($status, ['approved_pending_exit', 'partiellement_accepte']) || $isPartialApproval;
        $isRejected = $status === 'rejected' && !$isPartialApproval;
        $isPending = $status === 'pending' || $status === 'validated_by_manager';

        $frontendUrl = "http://localhost:4200/consumable-requests";

        $itemTitle = $this->requests->count() > 1
            ? $this->requests->count() . " articles"
            : ($firstRequest->item_name ?: 'Consommable');

        $subject = "Mise à jour de votre demande : " . $itemTitle;
        if ($isPartialApproval) {
            $subject = $isOwner ? "Demande Partiellement Acceptée : " . $itemTitle : "Approbation Partielle : " . $itemTitle;
        } elseif ($isApproval) {
            $subject = $isOwner ? "Demande Approuvée : " . $itemTitle : "Ordre de sortie : " . $itemTitle;
        }
        if ($isRejected) $subject = "Demande Refusée : " . $itemTitle;
        if ($isPending && !$isOwner) $subject = "Nouvelle demande à valider : " . $itemTitle;

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Bonjour {$notifiable->nomprenom},");

        if ($isApproval) {
            if ($isOwner) {
                if ($isPartialApproval) {
                    $mail->line("Votre demande de consommable a été traitée par le Directeur : certains articles ont été approuvés et d'autres refusés.");
                    $approvedReqs = $this->requests->filter(fn($r) => in_array(Str::lower($r->status), ['approved_pending_exit']));
                    if ($approvedReqs->count() > 0) {
                        $mail->line("Articles approuvés :");
                        foreach ($approvedReqs as $req) {
                            $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . ($req->approved_quantity ?: $req->requested_quantity) . ")");
                        }
                    }
                    $rejectedReqs = $this->requests->filter(fn($r) => Str::lower($r->status) === 'rejected');
                    if ($rejectedReqs->count() > 0) {
                        $mail->line("Articles refusés :");
                        foreach ($rejectedReqs as $req) {
                            $mail->line("- " . ($req->item_name ?: 'Produit') . " (Raison : " . ($req->reject_reason ?: 'Non spécifiée') . ")");
                        }
                    }
                } else {
                    $mail->line("Bonne nouvelle ! Votre demande de consommable a été approuvée par le Directeur.");
                    $mail->line("Articles approuvés :");
                    foreach ($this->requests as $req) {
                        $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . ($req->approved_quantity ?: $req->requested_quantity) . ")");
                    }
                }
                $mail->line("Vous recevrez votre matériel prochainement après confirmation du Responsable Logistique.")
                    ->action("Voir mes demandes", $frontendUrl);
            } else {
                if ($isPartialApproval) {
                    $mail->line("Une demande de consommable a été traitée par la Direction (approbation partielle) et attend votre confirmation de sortie pour les articles approuvés.")
                        ->line("Demandeur : {$user->nomprenom}");
                    $approvedReqs = $this->requests->filter(fn($r) => in_array(Str::lower($r->status), ['approved_pending_exit']));
                    if ($approvedReqs->count() > 0) {
                        $mail->line("Articles à sortir :");
                        foreach ($approvedReqs as $req) {
                            $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . ($req->approved_quantity ?: $req->requested_quantity) . ")");
                        }
                    }
                    $rejectedReqs = $this->requests->filter(fn($r) => Str::lower($r->status) === 'rejected');
                    if ($rejectedReqs->count() > 0) {
                        $mail->line("Articles refusés :");
                        foreach ($rejectedReqs as $req) {
                            $mail->line("- " . ($req->item_name ?: 'Produit'));
                        }
                    }
                } else {
                    $mail->line("Une nouvelle demande de consommable a été approuvée par la Direction et attend votre confirmation de sortie.")
                        ->line("Demandeur : {$user->nomprenom}");
                    $mail->line("Articles à sortir :");
                    foreach ($this->requests as $req) {
                        $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . ($req->approved_quantity ?: $req->requested_quantity) . ")");
                    }
                }
                $mail->line("Veuillez valider la sortie physique dans votre tableau de bord.")
                    ->action("Gérer les sorties", "http://localhost:4200/admin/validation-demandes");
            }
        } elseif ($status === 'approved') {
            $mail->subject('Sortie de consommable confirmée - ' . $itemTitle)
                ->line($isOwner ? 'Votre demande de consommable a été finalisée et la sortie physique a été enregistrée.' : 'La sortie physique pour la demande de ' . $user->nomprenom . ' a été confirmée.');
            $mail->line("Articles livrés :");
            foreach ($this->requests as $req) {
                $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . ($req->approved_quantity ?: $req->requested_quantity) . ")");
            }
            $mail->action("Consulter la demande", $isOwner ? $frontendUrl : "http://localhost:4200/admin/validation-demandes");
        } elseif ($isRejected) {
            $reason = $firstRequest->reject_reason ?: 'Non spécifiée';
            $mail->subject('Demande de consommable refusée - ' . $itemTitle)
                ->line('Nous vous informons que votre demande de consommable a été refusée.');
            $mail->line("Articles concernés :");
            foreach ($this->requests as $req) {
                $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . $req->requested_quantity . ")");
            }
            $mail->line('Raison du refus : ' . $reason)
                ->action("Consulter la demande", $frontendUrl);
        } else {
            // Notification for Director / Manager (Validation)
            $mail->line("Une nouvelle demande de consommable a été créée par {$user->nomprenom}.");
            $mail->line("Liste des articles demandés :");
            foreach ($this->requests as $req) {
                $mail->line("- " . ($req->item_name ?: 'Produit') . " (Quantité: " . $req->requested_quantity . ")");
            }
            $mail->action("Valider la demande", "http://localhost:4200/admin/validation-demandes")
                ->line("Merci d'approuver ou de rejeter cette demande.");
        }

        $mail->salutation("Cordialement,\nL'équipe Logistique");

        // Attach PDFs for partial approvals (approved and rejected items)
        $approvedRequests = $this->requests->filter(fn($r) => in_array($r->status, ['approved', 'approved_pending_exit', 'validated_by_manager']));
        $rejectedRequests = $this->requests->filter(fn($r) => $r->status === 'rejected');

        // Attach approved PDF
        $approvedPdf = null;
        if ($isStockManagerRecipient) {
            // Responsable/agent: prefer depot-specific approved PDF
            $approvedPdf = $approvedRequests->first(fn($r) =>
                $r->pdf_path &&
                str_contains($r->pdf_path, '_approved_depot_') &&
                \Illuminate\Support\Facades\Storage::disk('public')->exists($r->pdf_path)
            );
        }
        if (!$approvedPdf) {
            // Owner/director/others: prefer global approved PDF
            $approvedPdf = $approvedRequests->first(fn($r) =>
                $r->pdf_path &&
                str_contains($r->pdf_path, '_approved') &&
                !str_contains($r->pdf_path, '_approved_depot_') &&
                \Illuminate\Support\Facades\Storage::disk('public')->exists($r->pdf_path)
            );
        }
        if (!$approvedPdf) {
            // Last fallback: any approved PDF
            $approvedPdf = $approvedRequests->first(fn($r) =>
                $r->pdf_path &&
                str_contains($r->pdf_path, '_approved') &&
                \Illuminate\Support\Facades\Storage::disk('public')->exists($r->pdf_path)
            );
        }
        if ($approvedPdf) {
            $mail->attach(\Illuminate\Support\Facades\Storage::disk('public')->path($approvedPdf->pdf_path), [
                'as' => basename($approvedPdf->pdf_path),
                'mime' => 'application/pdf',
            ]);
        }

        // Attach rejected PDF
        $rejectedPdf = $rejectedRequests->first(fn($r) => $r->pdf_path && str_contains($r->pdf_path, '_rejected') && \Illuminate\Support\Facades\Storage::disk('public')->exists($r->pdf_path));
        if ($rejectedPdf) {
            $mail->attach(\Illuminate\Support\Facades\Storage::disk('public')->path($rejectedPdf->pdf_path), [
                'as' => basename($rejectedPdf->pdf_path),
                'mime' => 'application/pdf',
            ]);
        }

        // Fallback to single PDF for non-partial cases
        if (!$approvedPdf && !$rejectedPdf) {
            $reqWithPdf = $this->requests->first(fn($r) => $r->pdf_path && \Illuminate\Support\Facades\Storage::disk('public')->exists($r->pdf_path));
            if ($reqWithPdf) {
                $mail->attach(\Illuminate\Support\Facades\Storage::disk('public')->path($reqWithPdf->pdf_path), [
                    'as' => basename($reqWithPdf->pdf_path),
                    'mime' => 'application/pdf',
                ]);
            }
        }

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        $first = $this->requests->first();
        return [
            'consumable_request_id' => $first->id,
            'item_name' => $this->requests->count() > 1 ? $this->requests->count() . " articles" : $first->item_name,
            'user_id' => $first->user_id,
            'url' => '/admin/validation-demandes',
        ];
    }
}
