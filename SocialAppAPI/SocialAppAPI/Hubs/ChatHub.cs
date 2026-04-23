using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;
using SocialAppAPI.Services;
using SocialAppAPI.DTOs;

namespace SocialAppAPI.Hubs
{
    [Authorize] // 🔒 JWT required para makaconnect
    public class ChatHub : Hub
    {
        private readonly ChatService _chatService;

        // ── CONNECTION MAP ─────────────────────────────────────────────
        // Key   = UserId (string)
        // Value = SignalR ConnectionId
        // ConcurrentDictionary = thread-safe (maraming users ang sabay)
        private static readonly ConcurrentDictionary<string, string>
            _userConnections = new();

        public ChatHub(ChatService chatService)
        {
            _chatService = chatService;
        }

        // ══════════════════════════════════════════════════════════════
        //  CONNECTION EVENTS
        // ══════════════════════════════════════════════════════════════

        // ── Kapag nag-connect ang user ─────────────────────────────────
        public override async Task OnConnectedAsync()
        {
            // Kuhanin ang UserId mula sa JWT token
            var userId = GetCurrentUserId();

            if (!string.IsNullOrEmpty(userId))
            {
                // I-save ang connection: UserId → ConnectionId
                _userConnections[userId] = Context.ConnectionId;

                // I-join ang user sa kanyang personal na group
                // Group name = "user_123" (para sa userId = 123)
                await Groups.AddToGroupAsync(
                    Context.ConnectionId,
                    $"user_{userId}"
                );

                // Ipaalam sa lahat na naka-online na itong user
                await Clients.Others.SendAsync("UserOnline", userId);

                Console.WriteLine(
                    $"✅ User {userId} connected. " +
                    $"ConnectionId: {Context.ConnectionId}");
            }

            await base.OnConnectedAsync();
        }

        // ── Kapag nag-disconnect ang user ─────────────────────────────
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetCurrentUserId();

            if (!string.IsNullOrEmpty(userId))
            {
                // Tanggalin sa connection map
                _userConnections.TryRemove(userId, out _);

                // Ipaalam sa lahat na offline na
                await Clients.Others.SendAsync("UserOffline", userId);

                Console.WriteLine($"❌ User {userId} disconnected.");
            }

            await base.OnDisconnectedAsync(exception);
        }

        // ══════════════════════════════════════════════════════════════
        //  PRIVATE MESSAGING
        // ══════════════════════════════════════════════════════════════

        // ── SEND PRIVATE MESSAGE ───────────────────────────────────────
        // Frontend calls:
        // connection.invoke("SendPrivateMessage", receiverId, content)
        //
        // Note: senderId ay kinukuha mula sa JWT (hindi mula sa client)
        //       para hindi makapag-impersonate ng ibang user
        public async Task SendPrivateMessage(int receiverId, string content)
        {
            // Kuhanin ang senderId mula sa JWT (trusted source)
            var senderIdStr = GetCurrentUserId();

            if (string.IsNullOrEmpty(senderIdStr))
            {
                await Clients.Caller.SendAsync(
                    "Error", "Unauthorized: Invalid token.");
                return;
            }

            var senderId = int.Parse(senderIdStr);

            // ── Validation ─────────────────────────────────────────────
            if (string.IsNullOrWhiteSpace(content))
            {
                await Clients.Caller.SendAsync(
                    "Error", "Message cannot be empty.");
                return;
            }

            if (content.Length > 1000)
            {
                await Clients.Caller.SendAsync(
                    "Error", "Message cannot exceed 1000 characters.");
                return;
            }

            if (senderId == receiverId)
            {
                await Clients.Caller.SendAsync(
                    "Error", "You cannot message yourself.");
                return;
            }

            // ── Save sa existing Messages table ────────────────────────
            MessageDto savedMessage;
            try
            {
                savedMessage = await _chatService
                    .SaveMessageAsync(senderId, receiverId, content);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error saving message: {ex.Message}");
                await Clients.Caller.SendAsync(
                    "Error", "Failed to save message.");
                return;
            }

            // ── Send sa RECEIVER lang (private!) ───────────────────────
            // Ginagamit natin ang Group "user_{receiverId}"
            // para siguradong sa receiver lang mapupunta
            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("ReceivePrivateMessage", savedMessage);

            // ── Echo din sa SENDER (para makita niya ang sariling msg) ─
            await Clients
                .Group($"user_{senderId}")
                .SendAsync("ReceivePrivateMessage", savedMessage);

            Console.WriteLine(
                $"📨 Message from {senderId} to {receiverId}: {content}");
        }

        // ══════════════════════════════════════════════════════════════
        //  TYPING INDICATORS
        // ══════════════════════════════════════════════════════════════

        // ── Nagta-type ang user ────────────────────────────────────────
        // Frontend calls: connection.invoke("Typing", receiverId)
        public async Task Typing(int receiverId)
        {
            var senderIdStr = GetCurrentUserId();
            if (string.IsNullOrEmpty(senderIdStr)) return;

            // Ipadala lang sa receiver ang typing indicator
            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("UserTyping", int.Parse(senderIdStr));
        }

        // ── Tumigil na ang pag-type ────────────────────────────────────
        // Frontend calls: connection.invoke("StopTyping", receiverId)
        public async Task StopTyping(int receiverId)
        {
            var senderIdStr = GetCurrentUserId();
            if (string.IsNullOrEmpty(senderIdStr)) return;

            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("UserStoppedTyping", int.Parse(senderIdStr));
        }

        // ══════════════════════════════════════════════════════════════
        //  ONLINE STATUS
        // ══════════════════════════════════════════════════════════════

        // ── Check kung online ang isang user ──────────────────────────
        // Frontend calls: connection.invoke("CheckOnlineStatus", targetUserId)
        public async Task CheckOnlineStatus(int targetUserId)
        {
            var isOnline = _userConnections
                .ContainsKey(targetUserId.ToString());

            // Ibalik lang sa caller (hindi broadcast)
            await Clients.Caller.SendAsync(
                "OnlineStatus", targetUserId, isOnline);
        }

        // ── Get list of all online users ──────────────────────────────
        // Frontend calls: connection.invoke("GetOnlineUsers")
        public async Task GetOnlineUsers()
        {
            var onlineUserIds = _userConnections.Keys.ToList();
            await Clients.Caller.SendAsync("OnlineUsersList", onlineUserIds);
        }

        // ══════════════════════════════════════════════════════════════
        //  HELPER
        // ══════════════════════════════════════════════════════════════

        // Kuhanin ang UserId mula sa JWT claims
        private string? GetCurrentUserId()
        {
            return Context.User?
                .FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }
    }
}