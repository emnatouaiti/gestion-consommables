<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class NewUserCreated extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $plainPassword;

    /**
     * Create a new message instance.
     */
    public function __construct($user, $plainPassword)
    {
        $this->user = $user;
        $this->plainPassword = $plainPassword;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('Vos accès - nouveau compte')
                    ->view('emails.new_user')
                    ->with([
                        'name' => $this->user->nomprenom ?? $this->user->email,
                        'email' => $this->user->email,
                        'password' => $this->plainPassword,
                    ]);
    }
}
