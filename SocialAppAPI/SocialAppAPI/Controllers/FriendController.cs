using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Route: /api/friend
    [Authorize]                 // 🔒 Requires JWT token
    public class FriendController : ControllerBase
    {
        private readonly FriendService _friendService;

        public FriendController(FriendService friendService)
        {
            _friendService = friendService;
        }

        // Helper: get current user's ID from JWT
        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // ── SEND FRIEND REQUEST ────────────────────────────────────────
        // POST /api/friend/request/{addresseeId}
        [HttpPost("request/{addresseeId}")]
        public async Task<IActionResult> SendRequest(int addresseeId)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _friendService.SendRequestAsync(userId, addresseeId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // ── ACCEPT FRIEND REQUEST ──────────────────────────────────────
        // PUT /api/friend/accept/{friendshipId}
        [HttpPut("accept/{friendshipId}")]
        public async Task<IActionResult> AcceptRequest(int friendshipId)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _friendService.AcceptRequestAsync(userId, friendshipId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // ── REJECT FRIEND REQUEST ──────────────────────────────────────
        // PUT /api/friend/reject/{friendshipId}
        [HttpPut("reject/{friendshipId}")]
        public async Task<IActionResult> RejectRequest(int friendshipId)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _friendService.RejectRequestAsync(userId, friendshipId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // ── UNFRIEND ───────────────────────────────────────────────────
        // DELETE /api/friend/{friendshipId}
        [HttpDelete("{friendshipId}")]
        public async Task<IActionResult> Unfriend(int friendshipId)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _friendService.UnfriendAsync(userId, friendshipId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }

        // ── GET MY FRIENDS LIST ────────────────────────────────────────
        // GET /api/friend/list
        [HttpGet("list")]
        public async Task<IActionResult> GetFriends()
        {
            var userId = GetCurrentUserId();
            var friends = await _friendService.GetFriendsAsync(userId);
            return Ok(friends);
        }

        // ── GET PENDING REQUESTS ───────────────────────────────────────
        // GET /api/friend/requests
        [HttpGet("requests")]
        public async Task<IActionResult> GetPendingRequests()
        {
            var userId = GetCurrentUserId();
            var requests = await _friendService.GetPendingRequestsAsync(userId);
            return Ok(requests);
        }

        // ── GET FRIENDSHIP STATUS ──────────────────────────────────────
        // GET /api/friend/status/{otherUserId}
        [HttpGet("status/{otherUserId}")]
        public async Task<IActionResult> GetStatus(int otherUserId)
        {
            var userId = GetCurrentUserId();
            var (status, friendshipId) = await _friendService.GetStatusAsync(userId, otherUserId);
            return Ok(new { status, friendshipId });
        }

        // ── SEARCH USERS ───────────────────────────────────────────────
        // GET /api/friend/search?query=juan
        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query)
        {
            var userId = GetCurrentUserId();
            var users = await _friendService.SearchUsersAsync(userId, query);
            return Ok(users);
        }
    }
}