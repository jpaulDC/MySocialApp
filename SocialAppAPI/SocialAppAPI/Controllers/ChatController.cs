using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Route: /api/chat
    [Authorize]                 // 🔒 Requires JWT
    public class ChatController : ControllerBase
    {
        private readonly ChatService _chatService;

        public ChatController(ChatService chatService)
        {
            _chatService = chatService;
        }

        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // ── GET CONVERSATION HISTORY ───────────────────────────────────
        // GET /api/chat/conversation/{otherUserId}?page=1
        [HttpGet("conversation/{otherUserId}")]
        public async Task<IActionResult> GetConversation(
            int otherUserId, [FromQuery] int page = 1)
        {
            var userId = GetCurrentUserId();
            var messages = await _chatService
                .GetConversationAsync(userId, otherUserId, page);
            return Ok(messages);
        }

        // ── GET ALL CONVERSATIONS (inbox) ──────────────────────────────
        // GET /api/chat/conversations
        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var userId = GetCurrentUserId();
            var conversations = await _chatService.GetConversationsAsync(userId);
            return Ok(conversations);
        }

        // ── MARK MESSAGES AS READ ──────────────────────────────────────
        // PUT /api/chat/read/{otherUserId}
        [HttpPut("read/{otherUserId}")]
        public async Task<IActionResult> MarkAsRead(int otherUserId)
        {
            var userId = GetCurrentUserId();
            await _chatService.MarkAsReadAsync(userId, otherUserId);
            return Ok(new { message = "Messages marked as read." });
        }

        // ── GET UNREAD COUNT ───────────────────────────────────────────
        // GET /api/chat/unread
        [HttpGet("unread")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = GetCurrentUserId();
            var count = await _chatService.GetUnreadCountAsync(userId);
            return Ok(new { unreadCount = count });
        }
    }
}