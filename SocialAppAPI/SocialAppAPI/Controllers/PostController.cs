using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialAppAPI.DTOs;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Route: /api/post
    [Authorize]                 // 🔒 Requires JWT
    public class PostController : ControllerBase
    {
        private readonly PostService _postService;

        public PostController(PostService postService)
        {
            _postService = postService;
        }

        // Helper: get current user ID from JWT token
        private int GetCurrentUserId() =>
            int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        // ── CREATE POST ────────────────────────────────────────────────
        // POST /api/post
        [HttpPost]
        [Consumes("multipart/form-data")] // Accepts form data (for image upload)
        public async Task<IActionResult> CreatePost([FromForm] CreatePostDto dto)
        {
            var userId = GetCurrentUserId();
            var (success, message, post) = await _postService.CreatePostAsync(userId, dto);

            if (!success) return BadRequest(new { message });
            return Ok(new { message, post });
        }

        // ── GET FEED ───────────────────────────────────────────────────
        // GET /api/post/feed?page=1
        [HttpGet("feed")]
        public async Task<IActionResult> GetFeed([FromQuery] int page = 1)
        {
            var userId = GetCurrentUserId();
            var posts = await _postService.GetFeedAsync(userId, page);
            return Ok(posts);
        }

        // ── GET USER POSTS ─────────────────────────────────────────────
        // GET /api/post/user/{userId}
        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserPosts(int userId)
        {
            var currentUserId = GetCurrentUserId();
            var posts = await _postService.GetUserPostsAsync(userId, currentUserId);
            return Ok(posts);
        }

        // ── GET SINGLE POST ────────────────────────────────────────────
        // GET /api/post/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetPost(int id)
        {
            var userId = GetCurrentUserId();
            var post = await _postService.GetPostDtoAsync(id, userId);

            if (post == null) return NotFound(new { message = "Post not found." });
            return Ok(post);
        }

        // ── DELETE POST ────────────────────────────────────────────────
        // DELETE /api/post/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePost(int id)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _postService.DeletePostAsync(id, userId);

            if (!success) return BadRequest(new { message });
            return Ok(new { message });
        }
        [HttpPost("{id}/like")]
        public async Task<IActionResult> ToggleLike(int id)
        {
            var userId = GetCurrentUserId();
            // Tatawagin natin ang service para i-handle ang logic
            var (success, isLiked, likeCount, message) = await _postService.ToggleLikeAsync(id, userId);

            if (!success) return BadRequest(new { message });

            return Ok(new { isLiked, likeCount, message });
        }
    }
}