using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;
using SocialAppAPI.Services;
using SocialAppAPI.DTOs;

namespace SocialAppAPI.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly ChatService _chatService;

        // UserId (string) → ConnectionId
        // ConcurrentDictionary = thread-safe
        private static readonly ConcurrentDictionary<string, string>
            _userConnections = new();

        public ChatHub(ChatService chatService)
        {
            _chatService = chatService;
        }

        // ══════════════════════════════════════════════════════════════
        //  CONNECTION EVENTS
        // ══════════════════════════════════════════════════════════════

        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId))
            {
                await base.OnConnectedAsync();
                return;
            }

            // I-save ang connection
            _userConnections[userId] = Context.ConnectionId;

            // I-join ang personal group
            await Groups.AddToGroupAsync(
                Context.ConnectionId, $"user_{userId}");

            // ── MARK PENDING MESSAGES AS DELIVERED ────────────────────
            // Kapag nag-connect ang user, lahat ng undelivered
            // messages niya ay ma-mark as delivered
            var deliveredCount = await _chatService
                .MarkAsDeliveredAsync(int.Parse(userId));

            if (deliveredCount > 0)
            {
                // Ipaalam sa lahat ng senders na na-deliver na ang messages
                // Gagawin natin ito sa SendPrivateMessage na lang
                // para mas targeted
            }

            // Ipaalam sa lahat na online na itong user
            await Clients.Others.SendAsync("UserOnline", userId);

            Console.WriteLine($"✅ Connected: User {userId}");

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? ex)
        {
            var userId = GetUserId();
            if (!string.IsNullOrEmpty(userId))
            {
                _userConnections.TryRemove(userId, out _);

                // Ipaalam sa lahat na offline na
                await Clients.Others.SendAsync("UserOffline", userId);

                Console.WriteLine($"❌ Disconnected: User {userId}");
            }

            await base.OnDisconnectedAsync(ex);
        }

        // ══════════════════════════════════════════════════════════════
        //  PRIVATE MESSAGING
        // ══════════════════════════════════════════════════════════════

        // ── SEND PRIVATE MESSAGE ───────────────────────────────────────
        // Frontend: connection.invoke("SendPrivateMessage", receiverId, content)
        public async Task SendPrivateMessage(int receiverId, string content)
        {
            var senderIdStr = GetUserId();
            if (string.IsNullOrEmpty(senderIdStr)) return;

            var senderId = int.Parse(senderIdStr);

            // 1. Validation (Same as before)
            if (string.IsNullOrWhiteSpace(content)) return;
            if (senderId == receiverId) return;

            // 2. Check if receiver is online
            var isReceiverOnline = _userConnections.ContainsKey(receiverId.ToString());

            // 3. Save sa database
            var savedMessage = await _chatService.SaveMessageAsync(
                senderId, receiverId, content,
                isDelivered: isReceiverOnline
            );

            // ── FIX START HERE ──

            // 4. Send sa RECEIVER (Dapat pumasok sa group ng receiver)
            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("ReceivePrivateMessage", savedMessage);

            // 5. Echo sa SENDER (Gamitin ang .Caller para sigurado na sa device mo lang babalik)
            // Ito ang fix para hindi mag-duplicate o mag-ulo ang UI ng sender
            await Clients.Caller
                .SendAsync("ReceivePrivateMessage", savedMessage);

            // 6. Update Delivered Status para sa Sender UI
            if (isReceiverOnline)
            {
                await Clients.Caller.SendAsync("MessageDelivered", new
                {
                    messageId = savedMessage.Id,
                    receiverId = receiverId,
                    deliveredAt = DateTime.UtcNow
                });
            }

            Console.WriteLine($"📨 {senderId} → {receiverId}: {content}");
        }

        // ══════════════════════════════════════════════════════════════
        //  READ RECEIPTS (SEEN)
        // ══════════════════════════════════════════════════════════════

        // ── MARK MESSAGES AS READ ──────────────────────────────────────
        // Frontend: connection.invoke("MarkAsRead", senderId)
        // Tinatawag kapag binuksan ng receiver ang chat
        public async Task MarkAsRead(int otherUserId)
        {
            var userIdStr = GetUserId();
            if (string.IsNullOrEmpty(userIdStr)) return;

            var userId = int.Parse(userIdStr);

            // I-mark ang messages bilang nabasa na sa DB
            var readMessageIds = await _chatService.MarkAsReadAsync(userId, otherUserId);

            if (readMessageIds == null || !readMessageIds.Any()) return;

            // Ipaalam sa kabilang user (sender) na nabasa na ang messages niya
            await Clients.Group($"user_{otherUserId}")
                         .SendAsync("MessagesSeen", new
                         {
                             seenBy = userId,
                             messageIds = readMessageIds,
                             seenAt = DateTime.UtcNow
                         });
        }

        // ══════════════════════════════════════════════════════════════
        //  TYPING INDICATORS
        // ══════════════════════════════════════════════════════════════

        // Frontend: connection.invoke("Typing", receiverId)
        public async Task Typing(int receiverId)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId)) return;

            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("UserTyping", int.Parse(userId));
        }

        // Frontend: connection.invoke("StopTyping", receiverId)
        public async Task StopTyping(int receiverId)
        {
            var userId = GetUserId();
            if (string.IsNullOrEmpty(userId)) return;

            await Clients
                .Group($"user_{receiverId}")
                .SendAsync("UserStoppedTyping", int.Parse(userId));
        }

        // ══════════════════════════════════════════════════════════════
        //  ONLINE STATUS
        // ══════════════════════════════════════════════════════════════

        // Frontend: connection.invoke("CheckOnlineStatus", targetUserId)
        public async Task CheckOnlineStatus(int targetUserId)
        {
            var isOnline = _userConnections
                .ContainsKey(targetUserId.ToString());

            await Clients.Caller
                .SendAsync("OnlineStatus", targetUserId, isOnline);
        }

        // Frontend: connection.invoke("GetOnlineUsers")
        public async Task GetOnlineUsers()
        {
            var ids = _userConnections.Keys.ToList();
            await Clients.Caller.SendAsync("OnlineUsersList", ids);
        }

        // ── HELPER ────────────────────────────────────────────────────
        private string? GetUserId() =>
            Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}