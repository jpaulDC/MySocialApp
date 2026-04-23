using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;


namespace SocialAppAPI.Services
{
    public class AuthService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        // Constructor – injects database context and app configuration
        public AuthService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // ── REGISTER ───────────────────────────────────────────────────
        public async Task<(bool Success, string Message)> RegisterAsync(RegisterDto dto)
        {
            // Check if email is already taken
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
                return (false, "Email already in use.");

            // Check if username is already taken
            if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
                return (false, "Username already taken.");

            // Hash the password before saving (never store plain text!)
            var user = new User
            {
                Username = dto.Username,
                Email = dto.Email,
                FullName = dto.FullName,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return (true, "Registration successful!");
        }

        // ── LOGIN ──────────────────────────────────────────────────────
        public async Task<(bool Success, string Token, string Message)> LoginAsync(LoginDto dto)
        {
            // Find the user by email
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

            // Check if user exists AND password matches
            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return (false, "", "Invalid email or password.");

            // Generate JWT token for the user
            var token = GenerateJwtToken(user);

            return (true, token, "Login successful!");
        }

        // ── GENERATE JWT TOKEN ─────────────────────────────────────────
        private string GenerateJwtToken(User user)
        {
            // Read secret key from appsettings.json
            var jwtKey = _config["Jwt:Key"]!;
            var jwtIssuer = _config["Jwt:Issuer"]!;
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            // Claims = info embedded inside the token
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name,           user.Username),
                new Claim(ClaimTypes.Email,          user.Email)
            };

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtIssuer,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7), // Token valid for 7 days
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}