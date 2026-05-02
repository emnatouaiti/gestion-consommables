<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class NouvelleDemandePDF extends Mailable
{
    use Queueable, SerializesModels;

    public $demande;
    public $pdfPath;

    public function __construct($demande, $pdfPath)
    {
        $this->demande = $demande;
        $this->pdfPath = $pdfPath;
    }

    public function build()
    {
        return $this->subject('Nouvelle demande de consommable')
            ->view('emails.nouvelle_demande')
            ->attach($this->pdfPath, [
                'as' => 'demande.pdf',
                'mime' => 'application/pdf',
            ]);
    }
}
