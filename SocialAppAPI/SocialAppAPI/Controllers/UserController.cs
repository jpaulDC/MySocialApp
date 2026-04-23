using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SocialAppAPI.DTOs;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]  // Route: /api/user
    [Authorize]                  // 🔒 All endpoints require a valid JWT token
    public class UserController : ControllerBase
    {
        private readonly UserService _userService;

        public UserController(UserService userService)
        {
            _userService = userService;
        }

        // Helper: get the logged-in user's ID from their JWT token
        private int GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.Parse(claim!);
        }

        // ── GET MY PROFILE ─────────────────────────────────────────────
        // GET /api/user/me
        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = GetCurrentUserId();
            var profile = await _userService.GetProfileAsync(userId);

            if (profile == null)
                return NotFound(new { message = "User not found." });

            return Ok(profile);
        }

        // ── GET ANY USER'S PROFILE BY ID ───────────────────────────────
        // GET /api/user/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProfile(int id)
        {
            var profile = await _userService.GetProfileAsync(id);

            if (profile == null)
                return NotFound(new { message = "User not found." });

            return Ok(profile);
        }

        // ── UPDATE MY PROFILE ──────────────────────────────────────────
        // PUT /api/user/me
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = GetCurrentUserId();
            var (success, message) = await _userService.UpdateProfileAsync(userId, dto);

            if (!success)
                return BadRequest(new { message });

            return Ok(new { message });
        }

        // ── UPLOAD PROFILE PICTURE ─────────────────────────────────────
        // POST /api/user/me/picture
        [HttpPost("me/picture")]
        public async Task<IActionResult> UploadProfilePicture(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded." });

            var userId = GetCurrentUserId();
            var (success, message, url) = await _userService.UploadProfilePictureAsync(userId, file);

            if (!success)
                return BadRequest(new { message });

            // Return the URL so frontend can display the new picture
            return Ok(new { message, profilePictureUrl = url });
        }
    }
}