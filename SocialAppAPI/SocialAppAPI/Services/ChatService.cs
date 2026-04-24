using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;

namespace SocialAppAPI.Services
{
    public class ChatService
    {
        private readonly AppDbContext _context;

        public ChatService(AppDbContext context)
        {
            _context = context;
        }

        // ── SAVE MESSAGE ───────────────────────────────────────────────
        public async Task<MessageDto> SaveMessageAsync(
            int senderId, int receiverId,
            string content, bool isDelivered = false)
        {
            var message = new Message
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = content.Trim(),
                SentAt = DateTime.UtcNow,
                IsDelivered = isDelivered, // Set based on receiver online status
                IsRead = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            await _context.Entry(message)
                .Reference(m => m.Sender).LoadAsync();
            await _context.Entry(message)
                .Reference(m => m.Receiver).LoadAsync();

            return MapToDto(message, senderId);
        }

        // ── MARK AS DELIVERED ──────────────────────────────────────────
        // Called when receiver connects or comes online
        public async Task<int> MarkAsDeliveredAsync(int receiverId)
        {
            // Find all undelivered messages for this user
            var undelivered = await _context.Messages
                .Where(m =>
                    m.ReceiverId == receiverId &&
                    !m.IsDelivered &&
                    !m.IsRead)
                .ToListAsync();

            if (!undelivered.Any()) return 0;

            foreach (var msg in undelivered)
                msg.IsDelivered = true;

            await _context.SaveChangesAsync();

            // Return count of affected messages
            return undelivered.Count;
        }

        // ── MARK AS READ ───────────────────────────────────────────────
        // Called when receiver opens the chat
        public async Task<List<int>> MarkAsReadAsync(
            int currentUserId, int otherUserId)
        {
            var unread = await _context.Messages
                .Where(m =>
                    m.SenderId == otherUserId &&
                    m.ReceiverId == currentUserId &&
                    !m.IsRead)
                .ToListAsync();

            if (!unread.Any()) return new List<int>();

            var messageIds = new List<int>();

            foreach (var msg in unread)
            {
                msg.IsRead = true;
                msg.IsDelivered = true; // Also mark delivered
                msg.ReadAt = DateTime.UtcNow;
                messageIds.Add(msg.Id);
            }

            await _context.SaveChangesAsync();

            // Return IDs of messages that were marked as read
            // (para maalam ng sender kung alin ang nabasa)
            return messageIds;
        }

        // ── GET CONVERSATION HISTORY ───────────────────────────────────
        public async Task<List<MessageDto>> GetConversationAsync(
            int userId, int otherUserId,
            int page = 1, int pageSize = 30)
        {
            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m =>
                    (m.SenderId == userId && m.ReceiverId == otherUserId) ||
                    (m.SenderId == otherUserId && m.ReceiverId == userId))
                .OrderByDescending(m => m.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Reverse para lumabas ang oldest sa taas
            messages.Reverse();

            return messages.Select(m => MapToDto(m, userId)).ToList();
        }

        // ── GET ALL CONVERSATIONS (Inbox) ──────────────────────────────
        public async Task<List<ConversationDto>> GetConversationsAsync(
            int userId)
        {
            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m => m.SenderId == userId || m.ReceiverId == userId)
                .OrderByDescending(m => m.SentAt)
                .ToListAsync();

            return messages
                .GroupBy(m =>
                    m.SenderId == userId ? m.ReceiverId : m.SenderId)
                .Select(g =>
                {
                    var last = g.First();
                    var otherUser = last.SenderId == userId
                        ? last.Receiver
                        : last.Sender;

                    var unread = g.Count(m =>
                        m.SenderId == otherUser.Id &&
                        m.ReceiverId == userId &&
                        !m.IsRead);

                    return new ConversationDto
                    {
                        OtherUserId = otherUser.Id,
                        OtherUsername = otherUser.Username,
                        OtherFullName = otherUser.FullName,
                        OtherPicture = otherUser.ProfilePictureUrl,
                        LastMessage = last.Content,
                        LastMessageTime = last.SentAt,
                        UnreadCount = unread,
                        IsLastMessageMine = last.SenderId == userId
                    };
                })
                .OrderByDescending(c => c.LastMessageTime)
                .ToList();
        }

        // ── GET UNREAD COUNT ───────────────────────────────────────────
        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.Messages
                .CountAsync(m => m.ReceiverId == userId && !m.IsRead);
        }

        // ── HELPER: Map → DTO ──────────────────────────────────────────
        private MessageDto MapToDto(Message m, int currentUserId) =>
            new MessageDto
            {
                Id = m.Id,
                Content = m.Content,
                IsRead = m.IsRead,
                IsDelivered = m.IsDelivered,
                SentAt = m.SentAt,
                ReadAt = m.ReadAt,
                SenderId = m.Sender.Id,
                SenderUsername = m.Sender.Username,
                SenderFullName = m.Sender.FullName,
                SenderPicture = m.Sender.ProfilePictureUrl,
                ReceiverId = m.Receiver.Id,
                ReceiverUsername = m.Receiver.Username,
                ReceiverFullName = m.Receiver.FullName,
                ReceiverPicture = m.Receiver.ProfilePictureUrl,
                IsMyMessage = m.SenderId == currentUserId
            };
    }
}