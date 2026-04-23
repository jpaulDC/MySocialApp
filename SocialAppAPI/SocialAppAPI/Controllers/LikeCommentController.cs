using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialAppAPI.DTOs;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Route: /api/likecomment
    [Authorize]                 // 🔒 Requires JWT
    public class LikeCommentController : ControllerBase
    {
        private readonly LikeCommentService _service;

        public LikeCommentController(LikeCommentService service)
        {
            _service = service;
        }

        // Helper: get current user ID from JWT
        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // ══════════════════════════════════════════════════════════════
        //  LIKE ENDPOINTS
        // ══════════════════════════════════════════════════════════════

        // ── TOGGLE LIKE / UNLIKE ───────────────────────────────────────
        // POST /api/likecomment/like/{postId}
        [HttpPost("like/{postId}")]
        public async Task<IActionResult> ToggleLike(int postId)
        {
            var userId = GetCurrentUserId();
            var (success, action, likeCount) = await _service.ToggleLikeAsync(postId, userId);

            if (!success) return NotFound(new { message = action });

            return Ok(new
            {
                action,      // "liked" or "unliked"
                likeCount,   // Updated total like count
                isLiked = action == "liked"
            });
        }

        // ── GET USERS WHO LIKED A POST ─────────────────────────────────
        // GET /api/likecomment/likes/{postId}
        [HttpGet("likes/{postId}")]
        public async Task<IActionResult> GetLikes(int postId)
        {
            var users = await _service.GetLikesAsync(postId);
            return Ok(users);
        }

        // ══════════════════════════════════════════════════════════════
        //  COMMENT ENDPOINTS
        // ══════════════════════════════════════════════════════════════

        // ── ADD COMMENT ────────────────────────────────────────────────
        // POST /api/likecomment/comment/{postId}
        [HttpPost("comment/{postId}")]
        public async Task<IActionResult> AddComment(int postId, [FromBody] AddCommentDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            var (success, message, comment) = await _service.AddCommentAsync(postId, userId, dto);

            if (!success) return BadRequest(new { message });
            return Ok(new { message, comment });
        }

        // ── GET COMMENTS FOR A POST ────────────────────────────────────
        // GET /api/likecomment/comments/{postId}
        [HttpGet("comments/{postId}")]
        public async Task<IActionResult> GetComments(int postId)
        {
            var userId = GetCurrentUserId();
            var comments = await _service.GetCommentsAsync(postId, userId);
            return Ok(comments);
        }

        // ── DELETE COMMENT ─────────────────────────────────────────────
        // DELETE /api/likecomment/comment/{commentId}
        [HttpDelete("comment/{commentId}")]
        public async Task<IActionResult> DeleteComment(int commentId)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _service.DeleteCommentAsync(commentId, userId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }
    }
}