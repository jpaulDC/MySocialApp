using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SocialAppAPI.DTOs;
using SocialAppAPI.Services;
using System.Security.Claims;

namespace SocialAppAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // ← Secure! JWT required
    public class ReelController : ControllerBase
    {
        private readonly ReelService _reelService;

        public ReelController(ReelService reelService)
        {
            _reelService = reelService;
        }

        // Helper: Kukunin ang current user ID mula sa JWT
        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // GET: api/Reel (Feed)
        [HttpGet]
        public async Task<IActionResult> GetReels([FromQuery] int page = 1)
        {
            var userId = GetCurrentUserId();
            var reels = await _reelService.GetReelsAsync(userId, page);
            return Ok(reels);
        }

        // GET: api/Reel/user/{profileUserId}
        [HttpGet("user/{profileUserId}")]
        public async Task<IActionResult> GetUserReels(int profileUserId)
        {
            var currentUserId = GetCurrentUserId();
            var reels = await _reelService.GetUserReelsAsync(profileUserId, currentUserId);
            return Ok(reels);
        }

        // POST: api/Reel/upload
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadReel([FromForm] CreateReelDto dto)
        {
            var userId = GetCurrentUserId();
            var result = await _reelService.UploadReelAsync(userId, dto);
            if (!result.Success) return BadRequest(new { message = result.Message });
            return Ok(result);
        }

        // POST: api/Reel/{id}/like
        [HttpPost("{id}/like")]
        public async Task<IActionResult> ToggleLike(int id)
        {
            var userId = GetCurrentUserId();
            var result = await _reelService.ToggleLikeAsync(id, userId);
            if (!result.Success) return BadRequest(new { message = result.Action });
            return Ok(result);
        }

        // POST: api/Reel/{id}/comment
        [HttpPost("{id}/comment")]
        public async Task<IActionResult> AddComment(int id, [FromBody] string content)
        {
            var userId = GetCurrentUserId();
            var result = await _reelService.AddCommentAsync(id, userId, content);
            if (!result.Success) return BadRequest(new { message = result.Message });
            return Ok(result);
        }

        // GET: api/Reel/{id}/comments
        [HttpGet("{id}/comments")]
        public async Task<IActionResult> GetComments(int id)
        {
            var userId = GetCurrentUserId();
            var comments = await _reelService.GetCommentsAsync(id, userId);
            return Ok(comments);
        }

        // DELETE: api/Reel/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteReel(int id)
        {
            var userId = GetCurrentUserId();
            var result = await _reelService.DeleteReelAsync(id, userId);
            if (!result.Success) return BadRequest(new { message = result.Message });
            return Ok(new { message = result.Message });
        }
    }
}