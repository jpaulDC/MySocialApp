using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;

namespace SocialAppAPI.Services
{
    public class ReelService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public ReelService(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // ── UPLOAD REEL ────────────────────────────────────────────────
        public async Task<(bool Success, string Message, ReelDto? Reel)> UploadReelAsync(
            int userId, CreateReelDto dto)
        {
            // Validate video file exists
            if (dto.Video == null || dto.Video.Length == 0)
                return (false, "Video file is required.", null);

            // Validate video format
            var allowedTypes = new[]
            {
                "video/mp4", "video/quicktime",
                "video/x-msvideo", "video/webm"
            };
            if (!allowedTypes.Contains(dto.Video.ContentType.ToLower()))
                return (false, "Only MP4, MOV, AVI, and WebM videos are allowed.", null);

            // Validate size – max 100MB
            if (dto.Video.Length > 100 * 1024 * 1024)
                return (false, "Video must be less than 100MB.", null);

            // Create uploads/reels folder if needed
            var folder = Path.Combine(
                _env.WebRootPath ?? "wwwroot", "uploads", "reels");
            Directory.CreateDirectory(folder);

            // Save video file with unique filename
            var ext = Path.GetExtension(dto.Video.FileName);
            var fileName = $"reel_{userId}_{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
                await dto.Video.CopyToAsync(stream);

            // Create Reel record in database
            var reel = new Reel
            {
                UserId = userId,
                VideoUrl = $"/uploads/reels/{fileName}",
                Caption = dto.Caption?.Trim(),
                Duration = 0 // Duration detection handled on frontend
            };

            _context.Reels.Add(reel);
            await _context.SaveChangesAsync();

            // Load user for response
            await _context.Entry(reel).Reference(r => r.User).LoadAsync();

            var reelDto = MapToDto(reel, userId);
            return (true, "Reel uploaded successfully!", reelDto);
        }

        // ── GET ALL REELS (feed) ───────────────────────────────────────
        public async Task<List<ReelDto>> GetReelsAsync(
            int currentUserId, int page = 1, int pageSize = 10)
        {
            var reels = await _context.Reels
                .Include(r => r.User)
                .Include(r => r.Likes)
                .Include(r => r.Comments)
                .OrderByDescending(r => r.CreatedAt) // Newest first
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return reels.Select(r => MapToDto(r, currentUserId)).ToList();
        }

        // ── GET MY REELS ───────────────────────────────────────────────
        public async Task<List<ReelDto>> GetUserReelsAsync(
            int profileUserId, int currentUserId)
        {
            var reels = await _context.Reels
                .Include(r => r.User)
                .Include(r => r.Likes)
                .Include(r => r.Comments)
                .Where(r => r.UserId == profileUserId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return reels.Select(r => MapToDto(r, currentUserId)).ToList();
        }

        // ── TOGGLE REEL LIKE ───────────────────────────────────────────
        public async Task<(bool Success, string Action, int LikeCount)> ToggleLikeAsync(
            int reelId, int userId)
        {
            var reel = await _context.Reels
                .Include(r => r.Likes)
                .FirstOrDefaultAsync(r => r.Id == reelId);

            if (reel == null)
                return (false, "Reel not found.", 0);

            var existing = await _context.ReelLikes
                .FirstOrDefaultAsync(l => l.ReelId == reelId && l.UserId == userId);

            string action;
            if (existing != null)
            {
                _context.ReelLikes.Remove(existing);
                action = "unliked";
            }
            else
            {
                _context.ReelLikes.Add(new ReelLike
                {
                    ReelId = reelId,
                    UserId = userId
                });
                action = "liked";
            }

            await _context.SaveChangesAsync();

            var likeCount = await _context.ReelLikes.CountAsync(l => l.ReelId == reelId);
            return (true, action, likeCount);
        }

        // ── ADD REEL COMMENT ───────────────────────────────────────────
        public async Task<(bool Success, string Message, ReelCommentDto? Comment)>
            AddCommentAsync(int reelId, int userId, string content)
        {
            var reelExists = await _context.Reels.AnyAsync(r => r.Id == reelId);
            if (!reelExists)
                return (false, "Reel not found.", null);

            var comment = new ReelComment
            {
                ReelId = reelId,
                UserId = userId,
                Content = content.Trim()
            };

            _context.ReelComments.Add(comment);
            await _context.SaveChangesAsync();

            await _context.Entry(comment).Reference(c => c.User).LoadAsync();

            var dto = new ReelCommentDto
            {
                Id = comment.Id,
                Content = comment.Content,
                ReelId = comment.ReelId,
                UserId = comment.User.Id,
                Username = comment.User.Username,
                FullName = comment.User.FullName,
                ProfilePicture = comment.User.ProfilePictureUrl,
                IsMyComment = true,
                CreatedAt = comment.CreatedAt
            };

            return (true, "Comment added!", dto);
        }

        // ── GET REEL COMMENTS ──────────────────────────────────────────
        public async Task<List<ReelCommentDto>> GetCommentsAsync(
            int reelId, int currentUserId)
        {
            var comments = await _context.ReelComments
                .Include(c => c.User)
                .Where(c => c.ReelId == reelId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            return comments.Select(c => new ReelCommentDto
            {
                Id = c.Id,
                Content = c.Content,
                ReelId = c.ReelId,
                UserId = c.User.Id,
                Username = c.User.Username,
                FullName = c.User.FullName,
                ProfilePicture = c.User.ProfilePictureUrl,
                IsMyComment = c.UserId == currentUserId,
                CreatedAt = c.CreatedAt
            }).ToList();
        }

        // ── DELETE REEL ────────────────────────────────────────────────
        public async Task<(bool Success, string Message)> DeleteReelAsync(
            int reelId, int userId)
        {
            var reel = await _context.Reels.FindAsync(reelId);

            if (reel == null)
                return (false, "Reel not found.");

            if (reel.UserId != userId)
                return (false, "You can only delete your own reels.");

            // Delete video file from disk
            var filePath = Path.Combine(
                _env.WebRootPath ?? "wwwroot",
                reel.VideoUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

            if (File.Exists(filePath)) File.Delete(filePath);

            _context.Reels.Remove(reel);
            await _context.SaveChangesAsync();

            return (true, "Reel deleted.");
        }

        // ── HELPER: Map Reel → ReelDto ─────────────────────────────────
        private ReelDto MapToDto(Reel reel, int currentUserId) => new ReelDto
        {
            Id = reel.Id,
            VideoUrl = reel.VideoUrl,
            ThumbnailUrl = reel.ThumbnailUrl,
            Caption = reel.Caption,
            Duration = reel.Duration,
            UserId = reel.User.Id,
            Username = reel.User.Username,
            FullName = reel.User.FullName,
            ProfilePicture = reel.User.ProfilePictureUrl,
            LikeCount = reel.Likes.Count,
            CommentCount = reel.Comments.Count,
            IsLikedByMe = reel.Likes.Any(l => l.UserId == currentUserId),
            CreatedAt = reel.CreatedAt
        };
    }
}