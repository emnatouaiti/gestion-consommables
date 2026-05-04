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

    public function __construct(public ConsumableRequest $consumableRequest)
    {
    }

    public function via(object $notifiable): array
    {
        $channels = [];
        if (Schema::hasTable('notifications')) {
            $channels[] = 'database';
        }
        
        // Always send email to director as requested
        $channels[] = 'mail';

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $user = $this->consumableRequest->user;
        $status = Str::lower($this->consumableRequest->status);
        $isOwner = $notifiable->id === $this->consumableRequest->user_id;
        
        $isApproval = $status === 'approved_pending_exit';
        $isRejected = $status === 'rejected';
        
        $frontendUrl = "http://localhost:4200/consumable-requests";
        $adminUrl = "http://localhost:4200/admin/gerer-produits";
        
        $itemTitle = $this->consumableRequest->item_name ?: 'Consommable';
        $subject = "Mise à jour de votre demande : " . $itemTitle;
        if ($isApproval) $subject = $isOwner ? "Demande Approuvée : " . $itemTitle : "Ordre de sortie : " . $itemTitle;
        if ($isRejected) $subject = "Demande Refusée : " . $itemTitle;

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Bonjour {$notifiable->nomprenom},");

        if ($status === 'approved_pending_exit') {
            if ($isOwner) {
                // Message for the Employee
                $mail->line("Bonne nouvelle ! Votre demande de consommable a été approuvée par le Directeur.")
                    ->line("Article : {$itemTitle}")
                    ->line("Quantité Approuvée : {$this->consumableRequest->approved_quantity}")
                    ->line("Vous recevrez votre matériel prochainement après confirmation du Responsable Logistique.")
                    ->action("Voir mes demandes", $frontendUrl);
            } else {
                // Message for the Responsible / Manager
                $mail->line("Une nouvelle demande de consommable a été approuvée par la Direction et attend votre confirmation de sortie.")
                    ->line("Demandeur : {$user->nomprenom}")
                    ->line("Article : {$itemTitle}")
                    ->line("Quantité à sortir : {$this->consumableRequest->approved_quantity}")
                    ->line("Veuillez valider la sortie physique dans votre tableau de bord.")
                    ->action("Gérer les sorties", "http://localhost:4200/admin/validation-demandes");
            }
        } elseif ($status === 'approved') {
            $mail->subject('Sortie de consommable confirmée - ' . $itemTitle)
                ->line($isOwner ? 'Votre demande de consommable a été finalisée et la sortie physique a été enregistrée.' : 'La sortie physique pour la demande de ' . $user->nomprenom . ' a été confirmée.')
                ->line('Article : ' . $itemTitle)
                ->line('Quantité sortie : ' . ($this->consumableRequest->approved_quantity ?: $this->consumableRequest->requested_quantity))
                ->action("Consulter la demande", $isOwner ? $frontendUrl : "http://localhost:4200/admin/validation-demandes");
        } elseif ($status === 'rejected') {
            $reason = $this->consumableRequest->reject_reason ?: 'Non spécifiée';
            $mail->subject('Demande de consommable refusée - ' . $itemTitle)
                ->line('Nous vous informons que votre demande de consommable a été refusée.')
                ->line('Article : ' . $itemTitle)
                ->line('Raison du refus : ' . $reason)
                ->action("Consulter la demande", $frontendUrl);
        } else {
            // Notification for Director (New Request)
            $mail->subject("Mise à jour de votre demande : " . $itemTitle)
                ->line("Une nouvelle demande de consommable a été créée par {$user->nomprenom}.")
                ->line("Article : {$itemTitle}")
                ->line("Quantité Demandée : {$this->consumableRequest->requested_quantity}")
                ->action("Valider la demande", "http://localhost:4200/admin/validation-demandes")
                ->line("Merci d'approuver ou de rejeter cette demande.");
        }

        $mail->salutation("Regards,\nETAP");

        // Attach PDF if it exists
        if ($this->consumableRequest->pdf_path && \Illuminate\Support\Facades\Storage::disk('public')->exists($this->consumableRequest->pdf_path)) {
            $fileName = basename($this->consumableRequest->pdf_path);
            
            $mail->attach(\Illuminate\Support\Facades\Storage::disk('public')->path($this->consumableRequest->pdf_path), [
                'as' => $fileName,
                'mime' => 'application/pdf',
            ]);
        }

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'consumable_request_id' => $this->consumableRequest->id,
            'item_name' => $this->consumableRequest->item_name,
            'requested_quantity' => $this->consumableRequest->requested_quantity,
            'user_id' => $this->consumableRequest->user_id,
            'url' => '/admin/validation-demandes',
        ];
    }
}
