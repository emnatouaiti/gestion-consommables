<?php

namespace App\Http\Controllers\Chat;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function sendMessage(Request $request)
    {
        $data = $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'message' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|max:2048',
        ]);

        $sender = $request->user();
        $receiver = User::findOrFail($data['receiver_id']);

        if (!$this->canChat($sender, $receiver)) {
            return response()->json(['message' => 'Action non autorisee'], 403);
        }

        $messageText = trim((string) ($data['message'] ?? ''));
        $attachment = $request->file('attachment');

        if ($messageText === '' && !$attachment) {
            return response()->json(['message' => 'Le message ou le fichier est requis'], 422);
        }

        $payload = [
            'sender_id' => $sender->id,
            'receiver_id' => $receiver->id,
            'message' => $messageText,
            'is_read' => false,
        ];

        if ($attachment) {
            $payload['attachment_path'] = $attachment->store('chat-attachments', 'public');
            $payload['attachment_name'] = $attachment->getClientOriginalName();
            $payload['attachment_mime'] = $attachment->getClientMimeType();
            $payload['attachment_size'] = $attachment->getSize();
        }

        $message = Message::create($payload)->load([
            'sender:id,nomprenom,last_seen_at,role_id',
            'sender.role:id,name',
            'receiver:id,nomprenom,last_seen_at,role_id',
            'receiver.role:id,name',
        ]);

        return response()->json([
            'message' => 'Message envoye',
            'data' => $this->formatMessage($message),
        ], 201);
    }

    public function getMessages(int $userId)
    {
        $auth = request()->user();
        $other = User::findOrFail($userId);

        if (!$this->canChat($auth, $other)) {
            return response()->json(['message' => 'Action non autorisee'], 403);
        }

        Message::where('sender_id', $other->id)
            ->where('receiver_id', $auth->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        $messages = Message::with([
                'sender:id,nomprenom,last_seen_at,role_id',
                'sender.role:id,name',
                'receiver:id,nomprenom,last_seen_at,role_id',
                'receiver.role:id,name',
            ])
            ->where(function ($q) use ($auth, $other) {
                $q->where('sender_id', $auth->id)->where('receiver_id', $other->id);
            })
            ->orWhere(function ($q) use ($auth, $other) {
                $q->where('sender_id', $other->id)->where('receiver_id', $auth->id);
            })
            ->orderBy('created_at')
            ->get()
            ->map(fn (Message $message) => $this->formatMessage($message));

        return response()->json($messages);
    }

    public function getConversations()
    {
        $auth = request()->user();

        $rows = Message::selectRaw(
            'CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as user_id, MAX(created_at) as last_date',
            [$auth->id]
        )
            ->where(function ($q) use ($auth) {
                $q->where('sender_id', $auth->id)
                    ->orWhere('receiver_id', $auth->id);
            })
            ->groupBy('user_id')
            ->orderByDesc('last_date')
            ->get();

        $conversations = [];
        foreach ($rows as $row) {
            $user = User::find($row->user_id);
            if (!$user || !$this->canChat($auth, $user)) {
                continue;
            }

            $lastMessage = Message::where(function ($q) use ($auth, $user) {
                    $q->where('sender_id', $auth->id)->where('receiver_id', $user->id);
                })
                ->orWhere(function ($q) use ($auth, $user) {
                    $q->where('sender_id', $user->id)->where('receiver_id', $auth->id);
                })
                ->latest()
                ->first();

            $unread = Message::where('sender_id', $user->id)
                ->where('receiver_id', $auth->id)
                ->where('is_read', false)
                ->count();

            $preview = $lastMessage?->message;
            if (!$preview && $lastMessage?->attachment_name) {
                $preview = 'Fichier joint : ' . $lastMessage->attachment_name;
            }

            $conversations[] = [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'role' => $user->role?->name ?? null,
                    'last_seen_at' => $user->last_seen_at,
                ],
                'last_message' => $preview,
                'last_at' => optional($lastMessage)->created_at,
                'last_sender_id' => $lastMessage?->sender_id,
                'last_read_at' => $lastMessage?->read_at,
                'unread' => $unread,
            ];
        }

        return response()->json($conversations);
    }

    public function listUsers()
    {
        $auth = request()->user();
        $authRole = $this->normalizeRole($auth);

        $query = User::query()
            ->where('id', '<>', $auth->id)
            ->orderBy('nomprenom');

        // For responsables/agents: only users from same depot.
        if (in_array($authRole, ['manager', 'employee'], true) && !empty($auth->depot_id)) {
            $query->where('depot_id', $auth->depot_id);
        }

        $users = $query->get()
            ->filter(fn ($u) => $this->canChat($auth, $u))
            ->values()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role' => $u->role?->name ?? null,
                'last_seen_at' => $u->last_seen_at,
                'online' => $u->last_seen_at && now()->parse($u->last_seen_at)->gt(now()->subMinutes(5)),
            ]);

        return response()->json($users);
    }

    public function unreadCount()
    {
        $auth = request()->user();
        $count = Message::where('receiver_id', $auth->id)->where('is_read', false)->count();

        return response()->json(['count' => $count]);
    }

    private function canChat(User $auth, User $target): bool
    {
        $authRole = $this->normalizeRole($auth);
        $targetRole = $this->normalizeRole($target);

        if ($auth->id === $target->id) {
            return false;
        }

        if (!$authRole || !$targetRole) {
            return false;
        }

        return true;
    }

    private function normalizeRole(User $user): string
    {
        $role = strtolower((string) ($user->role?->name ?? ''));

        if (in_array($role, ['admin', 'administrateur'], true)) {
            return 'admin';
        }
        if (in_array($role, ['manager', 'responsable', 'gestionnaire', 'directeur', 'validateur'], true)) {
            return 'manager';
        }
        if (in_array($role, ['employee', 'employe', 'agent', 'utilisateur', 'agent de stock'], true)) {
            return 'employee';
        }
        if ($role === 'responsable de stock') {
            return 'manager';
        }

        return $role;
    }

    private function formatMessage(Message $message): array
    {
        $data = $message->toArray();
        $data['attachment_url'] = $message->attachment_path
            ? asset('storage/' . ltrim((string) $message->attachment_path, '/'))
            : null;
        $data['has_attachment'] = !empty($message->attachment_path);
        $data['is_image_attachment'] = $message->attachment_mime
            ? str_starts_with((string) $message->attachment_mime, 'image/')
            : false;

        return $data;
    }

    public function stream(Request $request)
    {
        set_time_limit(0);
        $user = null;

        // Try request user first
        if ($request->user()) {
            $user = $request->user();
        } else {
            $tokenStr = $request->query('token');
            if ($tokenStr) {
                if (str_starts_with($tokenStr, 'Bearer ')) {
                    $tokenStr = substr($tokenStr, 7);
                }
                $tokenModel = \Laravel\Sanctum\PersonalAccessToken::findToken($tokenStr);
                if ($tokenModel && $tokenModel->tokenable) {
                    $user = $tokenModel->tokenable;
                }
            }
        }

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $response = new \Symfony\Component\HttpFoundation\StreamedResponse(function () use ($user) {
            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache');
            header('Connection: keep-alive');
            header('X-Accel-Buffering: no');

            // Find current maximum message ID involving this user
            $lastMessageId = Message::where('sender_id', $user->id)
                ->orWhere('receiver_id', $user->id)
                ->max('id') ?? 0;

            // Find current unread count
            $lastUnreadCount = Message::where('receiver_id', $user->id)
                ->where('is_read', false)
                ->count();

            echo "event: connected\n";
            echo "data: " . json_encode(['status' => 'connected']) . "\n\n";
            ob_flush();
            flush();

            $isCliServer = php_sapi_name() === 'cli-server';
            $secondsLimit = $isCliServer ? 1 : 300; // 5 minutes limit (1 sec on CLI dev server)
            $start = time();
            $lastHeartbeat = time();

            while (time() - $start < $secondsLimit) {
                if (connection_aborted()) {
                    break;
                }

                $currentMaxId = Message::where('sender_id', $user->id)
                    ->orWhere('receiver_id', $user->id)
                    ->max('id') ?? 0;

                $currentUnreadCount = Message::where('receiver_id', $user->id)
                    ->where('is_read', false)
                    ->count();

                if ($currentMaxId > $lastMessageId || $currentUnreadCount !== $lastUnreadCount) {
                    $lastMessageId = $currentMaxId;
                    $lastUnreadCount = $currentUnreadCount;

                    echo "event: message\n";
                    echo "data: " . json_encode([
                        'type' => 'update',
                        'unread_count' => $currentUnreadCount
                    ]) . "\n\n";
                    ob_flush();
                    flush();
                }

                // Send heartbeat every 15 seconds to keep connection alive
                if (time() - $lastHeartbeat >= 15) {
                    echo "event: heartbeat\n";
                    echo "data: " . json_encode(['time' => time()]) . "\n\n";
                    ob_flush();
                    flush();
                    $lastHeartbeat = time();
                }

                sleep(2);
            }
        });

        // Set headers for SSE response
        $response->headers->set('Content-Type', 'text/event-stream');
        $response->headers->set('Cache-Control', 'no-cache');
        $response->headers->set('Connection', 'keep-alive');
        $response->headers->set('X-Accel-Buffering', 'no');

        return $response;
    }
}




