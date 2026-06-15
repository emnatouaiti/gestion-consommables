<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StockMovementResponseNotification extends Notification
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(public \App\Models\StockMovement $movement)
    {
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): \Illuminate\Notifications\Messages\MailMessage
    {
        $statusLabel = $this->movement->status === 'executed' ? 'APPROUVE' : 'REJETE';
        $color = $this->movement->status === 'executed' ? 'green' : 'red';
        $validator = $this->movement->validator->nomprenom ?? 'Le responsable';

        $mail = (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject("[$statusLabel] Reponse a votre mouvement : {$this->movement->reference}")
            ->greeting("Bonjour {$notifiable->nomprenom},")
            ->line("Votre demande de mouvement de stock **{$this->movement->reference}** a ete traitee par **$validator**.")
            ->line("Statut final : **$statusLabel**");

        if ($this->movement->response_notes) {
            $mail->line("Commentaire : \"{$this->movement->response_notes}\"");
        }

        if ($this->movement->response_pdf_path) {
            $mail->action('Telecharger la decision (PDF)', url(config('app.url') . '/api/docs/' . $this->movement->response_pdf_path));

            // Attach PDF if exists on disk
            $filePath = \Illuminate\Support\Facades\Storage::disk('public')->path($this->movement->response_pdf_path);
            if (file_exists($filePath)) {
                $mail->attach($filePath, [
                    'as' => 'Decision_' . $this->movement->reference . '.pdf',
                    'mime' => 'application/pdf',
                ]);
            }
        }

        return $mail->line("Merci d'utiliser notre plateforme.");
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'stock_movement_response',
            'movement_id' => $this->movement->id,
            'reference' => $this->movement->reference,
            'status' => $this->movement->status,
            'validator' => $this->movement->validator->nomprenom ?? 'Le responsable',
            'notes' => $this->movement->response_notes,
            'pdf' => $this->movement->response_pdf_path,
            'title' => 'Reponse mouvement',
            'message' => "Votre mouvement {$this->movement->reference} a ete " . ($this->movement->status === 'executed' ? 'approuve' : 'rejete'),
        ];
    }
}
