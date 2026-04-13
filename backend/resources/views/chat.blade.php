<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Chat interne</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; display: flex; height: 100vh; }
        .sidebar { width: 280px; border-right: 1px solid #ddd; overflow-y: auto; }
        .conversation { padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; display: flex; justify-content: space-between; }
        .conversation.active { background: #f5f8ff; }
        .conversation .name { font-weight: 600; }
        .conversation .meta { font-size: 12px; color: #666; }
        .chat { flex: 1; display: flex; flex-direction: column; }
        .messages { flex: 1; padding: 16px; overflow-y: auto; background: #fafafa; }
        .msg { margin-bottom: 12px; max-width: 70%; padding: 10px 12px; border-radius: 10px; position: relative; }
        .me { background: #d7eaff; margin-left: auto; }
        .them { background: #fff; border: 1px solid #eee; }
        .timestamp { font-size: 11px; color: #777; margin-top: 4px; text-align: right; }
        .composer { border-top: 1px solid #ddd; padding: 10px; display: flex; gap: 8px; }
        textarea { flex: 1; resize: none; height: 60px; padding: 8px; }
        button { padding: 10px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
        button:disabled { background: #999; cursor: not-allowed; }
        .badge { background: #e02424; color: #fff; border-radius: 12px; padding: 2px 8px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="sidebar" id="conversations"></div>
    <div class="chat">
        <div class="messages" id="messages">Sélectionnez une conversation.</div>
        <div class="composer">
            <textarea id="messageInput" placeholder="Votre message..."></textarea>
            <button id="sendBtn" disabled>Envoyer</button>
        </div>
    </div>

    <script>
        const conversationsEl = document.getElementById('conversations');
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const csrf = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        let selectedUser = null;
        let pollTimer = null;

        async function fetchJSON(url, options = {}) {
            const res = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrf,
                },
                credentials: 'same-origin',
                ...options,
            });
            if (!res.ok) throw new Error('Erreur réseau');
            return res.json();
        }

        async function loadConversations() {
            try {
                const data = await fetchJSON('/api/chat/conversations');
                conversationsEl.innerHTML = '';
                data.forEach(conv => {
                    const div = document.createElement('div');
                    div.className = 'conversation' + (selectedUser === conv.user.id ? ' active' : '');
                    div.onclick = () => selectUser(conv.user.id, conv.user.name);
                    div.innerHTML = `
                        <div>
                            <div class="name">${conv.user.name}</div>
                            <div class="meta">${conv.last_message || '—'}</div>
                        </div>
                        <div>
                            ${conv.unread ? `<span class="badge">${conv.unread}</span>` : ''}
                            <div class="meta">${conv.last_at ? new Date(conv.last_at).toLocaleString() : ''}</div>
                        </div>
                    `;
                    conversationsEl.appendChild(div);
                });
            } catch (e) {
                console.error(e);
            }
        }

        async function loadMessages() {
            if (!selectedUser) return;
            try {
                const data = await fetchJSON(`/api/chat/messages/${selectedUser}`);
                messagesEl.innerHTML = '';
                data.forEach(m => {
                    const div = document.createElement('div');
                    const isMe = m.sender_id === window.authId;
                    div.className = 'msg ' + (isMe ? 'me' : 'them');
                    div.innerHTML = `
                        <div>${m.message}</div>
                        <div class="timestamp">${new Date(m.created_at).toLocaleString()}</div>
                    `;
                    messagesEl.appendChild(div);
                });
                messagesEl.scrollTop = messagesEl.scrollHeight;
            } catch (e) {
                console.error(e);
            }
        }

        function selectUser(id) {
            selectedUser = id;
            sendBtn.disabled = false;
            loadMessages();
        }

        sendBtn.addEventListener('click', async () => {
            const text = inputEl.value.trim();
            if (!text || !selectedUser) return;
            sendBtn.disabled = true;
            try {
                await fetchJSON('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ receiver_id: selectedUser, message: text })
                });
                inputEl.value = '';
                await loadMessages();
                await loadConversations();
            } catch (e) {
                alert('Envoi impossible');
                console.error(e);
            } finally {
                sendBtn.disabled = false;
            }
        });

        function startPolling() {
            pollTimer = setInterval(() => {
                loadConversations();
                loadMessages();
            }, 5000);
        }

        (async function init() {
            // expose auth id for rendering bubbles
            window.authId = {{ auth()->id() }};
            await loadConversations();
            startPolling();
        })();
    </script>
</body>
</html>
