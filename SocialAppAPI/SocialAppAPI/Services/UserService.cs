using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;

namespace SocialAppAPI.Services
{
    public class UserService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env; // For accessing file system

        public UserService(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // ── GET PROFILE BY ID ──────────────────────────────────────────
        public async Task<UserProfileDto?> GetProfileAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null) return null;

            // Kunin ang stats mula sa database
            var postCount = await _context.Posts
                .CountAsync(p => p.UserId == userId);
            var friendCount = await _context.Friendships
                .CountAsync(f => (f.RequesterId == userId || f.AddresseeId == userId)
                              && f.Status == FriendshipStatus.Accepted);

            var likeCount = await _context.Likes
                .CountAsync(l => l.UserId == userId);

            return new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                FullName = user.FullName,
                Bio = user.Bio,
                ProfilePictureUrl = user.ProfilePictureUrl,
                CreatedAt = user.CreatedAt,
                PostCount = postCount,
                FriendCount = friendCount,
                LikeCount = likeCount
            };
        }

        // ── UPDATE PROFILE ─────────────────────────────────────────────
        public async Task<(bool Success, string Message)> UpdateProfileAsync(
            int userId, UpdateProfileDto dto)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
                return (false, "User not found.");

            // Only update fields that were provided (not null)
            if (dto.FullName != null) user.FullName = dto.FullName;
            if (dto.Bio != null) user.Bio = dto.Bio;

            await _context.SaveChangesAsync();
            return (true, "Profile updated successfully!");
        }

        // ── UPLOAD PROFILE PICTURE ─────────────────────────────────────
        public async Task<(bool Success, string Message, string? Url)> UploadProfilePictureAsync(
            int userId, IFormFile file)
        {
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
                return (false, "User not found.", null);

            // Validate file type – only images allowed
            var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
            if (!allowedTypes.Contains(file.ContentType.ToLower()))
                return (false, "Only image files are allowed (jpg, png, gif, webp).", null);

            // Validate file size – max 5MB
            if (file.Length > 5 * 1024 * 1024)
                return (false, "File size must be less than 5MB.", null);

            // Create uploads folder if it doesn't exist
            var uploadsFolder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "profiles");
            Directory.CreateDirectory(uploadsFolder);

            // Delete old profile picture if exists
            if (!string.IsNullOrEmpty(user.ProfilePictureUrl))
            {
                var oldFileName = Path.GetFileName(user.ProfilePictureUrl);
                var oldFilePath = Path.Combine(uploadsFolder, oldFileName);
                if (File.Exists(oldFilePath))
                    File.Delete(oldFilePath);
            }

            // Generate unique filename to avoid conflicts
            var extension = Path.GetExtension(file.FileName);
            var newFileName = $"user_{userId}_{Guid.NewGuid()}{extension}";
            var newFilePath = Path.Combine(uploadsFolder, newFileName);

            // Save the file to disk
            using (var stream = new FileStream(newFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Save the URL path to database
            user.ProfilePictureUrl = $"/uploads/profiles/{newFileName}";
            await _context.SaveChangesAsync();

            return (true, "Profile picture uploaded!", user.ProfilePictureUrl);
        }
    }
}