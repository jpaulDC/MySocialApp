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

        // ── GET REELS ──────────────────────────────────────────────────
        public async Task<List<ReelDto>> GetReelsAsync(int currentUserId, int page = 1)
        {
            int pageSize = 10;
            var reels = await _context.Reels
                .Include(r => r.User)
                .Include(r => r.Likes)
                .Include(r => r.Comments)
                .OrderByDescending(r => r.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return reels.Select(r => MapToDto(r, currentUserId)).ToList();
        }

        // ── GET USER REELS ─────────────────────────────────────────────
        public async Task<List<ReelDto>> GetUserReelsAsync(int targetUserId, int currentUserId)
        {
            var reels = await _context.Reels
                .Include(r => r.User)
                .Include(r => r.Likes)
                .Include(r => r.Comments)
                .Where(r => r.UserId == targetUserId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return reels.Select(r => MapToDto(r, currentUserId)).ToList();
        }

        // ── UPLOAD REEL ────────────────────────────────────────────────
        public async Task<(bool Success, string Message, ReelDto? Reel)> UploadReelAsync(int userId, CreateReelDto dto)
        {
            if (dto.Video == null || dto.Video.Length == 0)
                return (false, "Video file is required.", null);

            var allowedTypes = new[] { "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm" };
            if (!allowedTypes.Contains(dto.Video.ContentType.ToLower()))
                return (false, "Only MP4, MOV, AVI, and WebM videos are allowed.", null);

            if (dto.Video.Length > 100 * 1024 * 1024)
                return (false, "Video must be less than 100MB.", null);

            var folder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "reels");
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);

            var ext = Path.GetExtension(dto.Video.FileName);
            var fileName = $"reel_{userId}_{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
                await dto.Video.CopyToAsync(stream);

            var reel = new Reel
            {
                UserId = userId,
                VideoUrl = $"/uploads/reels/{fileName}",
                Caption = dto.Caption?.Trim(),
                Duration = 0,
                CreatedAt = DateTime.UtcNow
            };

            _context.Reels.Add(reel);
            await _context.SaveChangesAsync();

            await _context.Entry(reel).Reference(r => r.User).LoadAsync();

            return (true, "Reel uploaded successfully!", MapToDto(reel, userId));
        }

        // ── TOGGLE LIKE ────────────────────────────────────────────────
        public async Task<(bool Success, string Action, int LikeCount)> ToggleLikeAsync(int reelId, int userId)
        {
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
                _context.ReelLikes.Add(new ReelLike { ReelId = reelId, UserId = userId });
                action = "liked";
            }

            await _context.SaveChangesAsync();
            var likeCount = await _context.ReelLikes.CountAsync(l => l.ReelId == reelId);
            return (true, action, likeCount);
        }

        // ── ADD COMMENT ────────────────────────────────────────────────
        public async Task<(bool Success, string Message, ReelCommentDto? Comment)> AddCommentAsync(int reelId, int userId, string content)
        {
            var reelExists = await _context.Reels.AnyAsync(r => r.Id == reelId);
            if (!reelExists) return (false, "Reel not found.", null);

            var comment = new ReelComment
            {
                ReelId = reelId,
                UserId = userId,
                Content = content.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.ReelComments.Add(comment);
            await _context.SaveChangesAsync();
            await _context.Entry(comment).Reference(c => c.User).LoadAsync();

            var dto = new ReelCommentDto
            {
                Id = comment.Id,
                Content = comment.Content,
                ReelId = comment.ReelId,
                UserId = comment.UserId,
                Username = comment.User?.Username ?? "Unknown",
                FullName = comment.User?.FullName,
                ProfilePicture = comment.User?.ProfilePictureUrl,
                IsMyComment = true,
                CreatedAt = comment.CreatedAt
            };

            return (true, "Comment added!", dto);
        }

        // ── GET COMMENTS ───────────────────────────────────────────────
        public async Task<List<ReelCommentDto>> GetCommentsAsync(int reelId, int currentUserId)
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
                UserId = c.UserId,
                Username = c.User?.Username ?? "Unknown",
                FullName = c.User?.FullName,
                ProfilePicture = c.User?.ProfilePictureUrl,
                IsMyComment = c.UserId == currentUserId,
                CreatedAt = c.CreatedAt
            }).ToList();
        }

        // ── DELETE REEL ────────────────────────────────────────────────
        public async Task<(bool Success, string Message)> DeleteReelAsync(int reelId, int userId)
        {
            var reel = await _context.Reels.FindAsync(reelId);
            if (reel == null) return (false, "Reel not found.");
            if (reel.UserId != userId) return (false, "Unauthorized.");

            try
            {
                _context.Reels.Remove(reel);
                await _context.SaveChangesAsync();

                var filePath = Path.Combine(_env.WebRootPath ?? "wwwroot",
                    reel.VideoUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

                if (File.Exists(filePath))
                {
                    GC.Collect();
                    GC.WaitForPendingFinalizers();
                    File.Delete(filePath);
                }

                return (true, "Reel deleted successfully.");
            }
            catch (Exception ex)
            {
                return (true, $"Deleted from database, but file error: {ex.Message}");
            }
        }

        // ── HELPER: Map Reel → ReelDto ─────────────────────────────────
        private ReelDto MapToDto(Reel reel, int currentUserId) => new ReelDto
        {
            Id = reel.Id,
            VideoUrl = reel.VideoUrl,
            ThumbnailUrl = reel.ThumbnailUrl,
            Caption = reel.Caption,
            Duration = reel.Duration,
            UserId = reel.UserId,
            Username = reel.User?.Username ?? "Unknown",
            FullName = reel.User?.FullName,
            ProfilePicture = reel.User?.ProfilePictureUrl,
            LikeCount = reel.Likes?.Count ?? 0,
            CommentCount = reel.Comments?.Count ?? 0,
            IsLikedByMe = reel.Likes?.Any(l => l.UserId == currentUserId) ?? false,
            CreatedAt = reel.CreatedAt
        };
    }
}