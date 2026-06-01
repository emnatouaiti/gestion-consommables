<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\ProductStock;
use App\Models\Supplier;

class ReturnToSupplierMail extends Mailable
{
    use Queueable, SerializesModels;

    public $stock;
    public $supplier;
    public $justification;
    public $pdfPath;

    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct(ProductStock $stock, Supplier $supplier, string $justification, string $pdfPath)
    {
        $this->stock = $stock;
        $this->supplier = $supplier;
        $this->justification = $justification;
        $this->pdfPath = $pdfPath;
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $mail = $this->subject('Notification de Retour de Marchandise - Lot ExpirÃ©')
                    ->view('emails.return_supplier');

        if (file_exists($this->pdfPath)) {
            $mail->attach($this->pdfPath, [
                'as' => 'Bon_de_Retour_' . $this->stock->batch_number . '.pdf',
                'mime' => 'application/pdf',
            ]);
        }

        return $mail;
    }
}
