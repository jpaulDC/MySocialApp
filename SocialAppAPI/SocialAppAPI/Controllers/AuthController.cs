using Microsoft.AspNetCore.Mvc;
using SocialAppAPI.DTOs;
using SocialAppAPI.Services;

namespace SocialAppAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Route: /api/auth
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        // POST /api/auth/register
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            // Validate incoming data (checks [Required], [EmailAddress], etc.)
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var (success, message) = await _authService.RegisterAsync(dto);

            if (!success)
                return BadRequest(new { message }); // 400 – e.g., duplicate email

            return Ok(new { message }); // 200 – registration OK
        }

        // POST /api/auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var (success, token, message) = await _authService.LoginAsync(dto);

            if (!success)
                return Unauthorized(new { message }); // 401 – wrong credentials

            // Return the JWT token to the client
            return Ok(new { token, message });
        }
    }
}