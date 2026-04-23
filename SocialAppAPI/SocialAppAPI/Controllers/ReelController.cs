using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialAppAPI.DTOs;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Route: /api/reel
    [Authorize]                 // 🔒 Requires JWT
    public class ReelController : ControllerBase
    {
        private readonly ReelService _reelService;

        public ReelController(ReelService reelService)
        {
            _reelService = reelService;
        }

        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // ── UPLOAD REEL ────────────────────────────────────────────────
        // POST /api/reel
        [HttpPost]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadReel([FromForm] CreateReelDto dto)
        {
            var userId = GetCurrentUserId();
            var (success, message, reel) = await _reelService.UploadReelAsync(userId, dto);

            if (!success) return BadRequest(new { message });
            return Ok(new { message, reel });
        }

        // ── GET REELS FEED ─────────────────────────────────────────────
        // GET /api/reel/feed?page=1
        [HttpGet("feed")]
        public async Task<IActionResult> GetFeed([FromQuery] int page = 1)
        {
            var userId = GetCurrentUserId();
            var reels = await _reelService.GetReelsAsync(userId, page);
            return Ok(reels);
        }

        // ── GET USER REELS ─────────────────────────────────────────────
        // GET /api/reel/user/{userId}
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserReels(int userId)
        {
            var currentUserId = GetCurrentUserId();
            var reels = await _reelService.GetUserReelsAsync(userId, currentUserId);
            return Ok(reels);
        }

        // ── TOGGLE LIKE ────────────────────────────────────────────────
        // POST /api/reel/like/{reelId}
        [HttpPost("like/{reelId}")]
        public async Task<IActionResult> ToggleLike(int reelId)
        {
            var userId = GetCurrentUserId();
            var (success, action, likeCount) =
                await _reelService.ToggleLikeAsync(reelId, userId);

            if (!success) return NotFound(new { message = action });
            return Ok(new { action, likeCount, isLiked = action == "liked" });
        }

        // ── ADD COMMENT ────────────────────────────────────────────────
        // POST /api/reel/comment/{reelId}
        [HttpPost("comment/{reelId}")]
        public async Task<IActionResult> AddComment(
            int reelId, [FromBody] AddCommentDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            var (success, message, comment) =
                await _reelService.AddCommentAsync(reelId, userId, dto.Content);

            if (!success) return BadRequest(new { message });
            return Ok(new { message, comment });
        }

        // ── GET COMMENTS ───────────────────────────────────────────────
        // GET /api/reel/comments/{reelId}
        [HttpGet("comments/{reelId}")]
        public async Task<IActionResult> GetComments(int reelId)
        {
            var userId = GetCurrentUserId();
            var comments = await _reelService.GetCommentsAsync(reelId, userId);
            return Ok(comments);
        }

        // ── DELETE REEL ────────────────────────────────────────────────
        // DELETE /api/reel/{reelId}
        [HttpDelete("{reelId}")]
        public async Task<IActionResult> DeleteReel(int reelId)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _reelService.DeleteReelAsync(reelId, userId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }
    }
}