using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using SocialAppAPI.Services;

namespace SocialAppAPI.Hubs
{
    [Authorize] // 🔒 Only authenticated users can connect
    public class ChatHub : Hub
    {
        private readonly ChatService _chatService;

        // Thread-safe dictionary: UserId → ConnectionId
        // Tracks which users are currently connected
        private static readonly ConcurrentDictionary<int, string>
            OnlineUsers = new();

        public ChatHub(ChatService chatService)
        {
            _chatService = chatService;
        }

        // ── CALLED WHEN A CLIENT CONNECTS ─────────────────────────────
        public override async Task OnConnectedAsync()
        {
            var userId = GetCurrentUserId();

            if (userId > 0)
            {
                // Store this user's connection
                OnlineUsers[userId] = Context.ConnectionId;

                // Add user to their personal group (for targeted messages)
                await Groups.AddToGroupAsync(
                    Context.ConnectionId, $"user_{userId}");

                // Notify everyone that this user is now online
                await Clients.Others.SendAsync("UserOnline", userId);
            }

            await base.OnConnectedAsync();
        }

        // ── CALLED WHEN A CLIENT DISCONNECTS ──────────────────────────
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetCurrentUserId();

            if (userId > 0)
            {
                // Remove from online users
                OnlineUsers.TryRemove(userId, out _);

                // Notify others this user went offline
                await Clients.Others.SendAsync("UserOffline", userId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        // ── SEND MESSAGE (called by client) ────────────────────────────
        // Client calls: hubConnection.invoke("SendMessage", receiverId, content)
        public async Task SendMessage(int receiverId, string content)
        {
            var senderId = GetCurrentUserId();

            if (senderId <= 0 || string.IsNullOrWhiteSpace(content))
                return;

            // Validate content length
            if (content.Length > 1000)
            {
                await Clients.Caller.SendAsync(
                    "Error", "Message cannot exceed 1000 characters.");
                return;
            }

            // Save message to database
            var messageDto = await _chatService.SaveMessageAsync(
                senderId, receiverId, content);

            // Send to RECEIVER (if online) via their group
            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("ReceiveMessage", messageDto);

            // Also echo back to SENDER (so they see their own message)
            await Clients
                .Group($"user_{senderId}")
                .SendAsync("ReceiveMessage", messageDto);
        }

        // ── NOTIFY TYPING ──────────────────────────────────────────────
        // Client calls: hubConnection.invoke("Typing", receiverId)
        public async Task Typing(int receiverId)
        {
            var senderId = GetCurrentUserId();
            if (senderId <= 0) return;

            // Tell the receiver that someone is typing
            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("UserTyping", senderId);
        }

        // ── STOP TYPING ───────────────────────────────────────────────
        public async Task StopTyping(int receiverId)
        {
            var senderId = GetCurrentUserId();
            if (senderId <= 0) return;

            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("UserStoppedTyping", senderId);
        }

        // ── MARK MESSAGES AS READ ──────────────────────────────────────
        // Client calls: hubConnection.invoke("MarkRead", otherUserId)
        public async Task MarkRead(int otherUserId)
        {
            var userId = GetCurrentUserId();
            if (userId <= 0) return;

            await _chatService.MarkAsReadAsync(userId, otherUserId);

            // Notify sender that messages were read (for read receipts)
            await Clients
                .Group($"user_{otherUserId}")
                .SendAsync("MessagesRead", userId);
        }

        // ── CHECK IF USER IS ONLINE ────────────────────────────────────
        public async Task CheckOnlineStatus(int targetUserId)
        {
            var isOnline = OnlineUsers.ContainsKey(targetUserId);
            await Clients.Caller.SendAsync("OnlineStatus", targetUserId, isOnline);
        }

        // ── HELPER: Get current user ID from JWT claim ─────────────────
        private int GetCurrentUserId()
        {
            var claim = Context.User?
                .FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }
    }
}