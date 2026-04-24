using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SocialAppAPI.Services
{
    public class ChatService
    {
        private readonly AppDbContext _context;

        public ChatService(AppDbContext context)
        {
            _context = context;
        }

        // ── SAVE MESSAGE TO DATABASE ───────────────────────────────────
        public async Task<MessageDto> SaveMessageAsync(int senderId, int receiverId, string content)
        {
            var message = new Message
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = content.Trim(),
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            // Load sender and receiver info for the response
            await _context.Entry(message).Reference(m => m.Sender).LoadAsync();
            await _context.Entry(message).Reference(m => m.Receiver).LoadAsync();

            return MapToDto(message, senderId);
        }

        // ── GET CONVERSATION HISTORY ───────────────────────────────────
        public async Task<List<MessageDto>> GetConversationAsync(int userId, int otherUserId, int page = 1, int pageSize = 30)
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

            messages.Reverse();

            return messages.Select(m => MapToDto(m, userId)).ToList();
        }

        // ── GET ALL CONVERSATIONS (inbox) ──────────────────────────────
        public async Task<List<ConversationDto>> GetConversationsAsync(int userId)
        {
            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Receiver)
                .Where(m => m.SenderId == userId || m.ReceiverId == userId)
                .OrderByDescending(m => m.SentAt)
                .ToListAsync();

            var conversations = messages
                .GroupBy(m => m.SenderId == userId ? m.ReceiverId : m.SenderId)
                .Select(g =>
                {
                    var lastMsg = g.First();
                    var otherUser = lastMsg.SenderId == userId ? lastMsg.Receiver : lastMsg.Sender;

                    var unreadCount = g.Count(m =>
                        m.SenderId == otherUser.Id &&
                        m.ReceiverId == userId &&
                        !m.IsRead);

                    return new ConversationDto
                    {
                        OtherUserId = otherUser.Id,
                        OtherUsername = otherUser.Username,
                        OtherFullName = otherUser.FullName,
                        OtherPicture = otherUser.ProfilePictureUrl,
                        LastMessage = lastMsg.Content,
                        LastMessageTime = lastMsg.SentAt,
                        UnreadCount = unreadCount,
                        IsLastMessageMine = lastMsg.SenderId == userId
                    };
                })
                .OrderByDescending(c => c.LastMessageTime)
                .ToList();

            return conversations;
        }

        // ── MARK MESSAGES AS READ ──────────────────────────────────────
        public async Task MarkAsReadAsync(int currentUserId, int otherUserId)
        {
            var unread = await _context.Messages
                .Where(m =>
                    m.SenderId == otherUserId &&
                    m.ReceiverId == currentUserId &&
                    !m.IsRead)
                .ToListAsync();

            if (!unread.Any()) return;

            foreach (var msg in unread)
            {
                msg.IsRead = true;
                msg.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
        }

        // ── GET TOTAL UNREAD COUNT (for badge notification) ────────────
        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.Messages
                .CountAsync(m => m.ReceiverId == userId && !m.IsRead);
        }

        // ── HELPER: Map Message → MessageDto ───────────────────────────
        private MessageDto MapToDto(Message message, int currentUserId) =>
            new MessageDto
            {
                Id = message.Id,
                Content = message.Content,
                IsRead = message.IsRead,
                SentAt = message.SentAt,
                ReadAt = message.ReadAt,
                SenderId = message.Sender.Id,
                SenderUsername = message.Sender.Username,
                SenderFullName = message.Sender.FullName,
                SenderPicture = message.Sender.ProfilePictureUrl,
                ReceiverId = message.Receiver.Id,
                ReceiverUsername = message.Receiver.Username,
                ReceiverFullName = message.Receiver.FullName,
                ReceiverPicture = message.Receiver.ProfilePictureUrl,
                IsMyMessage = message.SenderId == currentUserId
            };
    }
}