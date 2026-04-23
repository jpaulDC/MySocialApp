using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;

namespace SocialAppAPI.Services
{
    public class PostService
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public PostService(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // ── TOGGLE LIKE (NEW METHOD) ───────────────────────────────────
        public async Task<(bool success, bool isLiked, int likeCount, string message)> ToggleLikeAsync(int postId, int userId)
        {
            // 1. I-check kung exist ang post
            var post = await _context.Posts.Include(p => p.Likes).FirstOrDefaultAsync(p => p.Id == postId);
            if (post == null) return (false, false, 0, "Post not found.");

            // 2. I-check kung na-like na ng user
            var existingLike = await _context.Likes
                .FirstOrDefaultAsync(l => l.PostId == postId && l.UserId == userId);

            bool isLikedNow;

            if (existingLike != null)
            {
                // UNLIKE: Burahin ang record
                _context.Likes.Remove(existingLike);
                isLikedNow = false;
            }
            else
            {
                // LIKE: Magdagdag ng bagong record
                var newLike = new Like { PostId = postId, UserId = userId };
                _context.Likes.Add(newLike);
                isLikedNow = true;
            }

            await _context.SaveChangesAsync();

            // Kunin ang bagong count
            var currentLikeCount = await _context.Likes.CountAsync(l => l.PostId == postId);

            return (true, isLikedNow, currentLikeCount, isLikedNow ? "Post liked." : "Post unliked.");
        }

        // ── CREATE POST ────────────────────────────────────────────────
        public async Task<(bool Success, string Message, PostDto? Post)> CreatePostAsync(
            int userId, CreatePostDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Content) && dto.Image == null)
                return (false, "Post must have content or an image.", null);

            var post = new Post
            {
                UserId = userId,
                Content = dto.Content,
                Type = PostType.Text,
                CreatedAt = DateTime.UtcNow // Siguraduhin na may timestamp
            };

            if (dto.Image != null)
            {
                var allowed = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
                if (!allowed.Contains(dto.Image.ContentType.ToLower()))
                    return (false, "Only image files are allowed.", null);

                if (dto.Image.Length > 10 * 1024 * 1024)
                    return (false, "Image must be less than 10MB.", null);

                var folder = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "posts");
                Directory.CreateDirectory(folder);

                var ext = Path.GetExtension(dto.Image.FileName);
                var fileName = $"post_{userId}_{Guid.NewGuid()}{ext}";
                var filePath = Path.Combine(folder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                    await dto.Image.CopyToAsync(stream);

                post.ImageUrl = $"/uploads/posts/{fileName}";
                post.Type = PostType.Image;
            }

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            var postDto = await GetPostDtoAsync(post.Id, userId);
            return (true, "Post created!", postDto);
        }

        // ── GET FEED ───────────────────────────────────────────────────
        public async Task<List<PostDto>> GetFeedAsync(int userId, int page = 1, int pageSize = 10)
        {
            var friendIds = await _context.Friendships
                .Where(f => (f.RequesterId == userId || f.AddresseeId == userId) && f.Status == FriendshipStatus.Accepted)
                .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
                .ToListAsync();

            friendIds.Add(userId);

            var posts = await _context.Posts
                .Include(p => p.User)
                .Include(p => p.Likes)
                .Include(p => p.Comments)
                .Where(p => friendIds.Contains(p.UserId))
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return posts.Select(p => MapToDto(p, userId)).ToList();
        }

        // ── GET USER POSTS ─────────────────────────────────────────────
        public async Task<List<PostDto>> GetUserPostsAsync(int profileUserId, int currentUserId)
        {
            var posts = await _context.Posts
                .Include(p => p.User)
                .Include(p => p.Likes)
                .Include(p => p.Comments)
                .Where(p => p.UserId == profileUserId)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            return posts.Select(p => MapToDto(p, currentUserId)).ToList();
        }

        // ── GET SINGLE POST ────────────────────────────────────────────
        public async Task<PostDto?> GetPostDtoAsync(int postId, int currentUserId)
        {
            var post = await _context.Posts
                .Include(p => p.User)
                .Include(p => p.Likes)
                .Include(p => p.Comments)
                .FirstOrDefaultAsync(p => p.Id == postId);

            if (post == null) return null;
            return MapToDto(post, currentUserId);
        }

        // ── DELETE POST ────────────────────────────────────────────────
        public async Task<(bool Success, string Message)> DeletePostAsync(int postId, int userId)
        {
            var post = await _context.Posts.FindAsync(postId);
            if (post == null) return (false, "Post not found.");
            if (post.UserId != userId) return (false, "You can only delete your own posts.");

            if (!string.IsNullOrEmpty(post.ImageUrl))
            {
                var filePath = Path.Combine(_env.WebRootPath ?? "wwwroot", post.ImageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(filePath)) File.Delete(filePath);
            }

            _context.Posts.Remove(post);
            await _context.SaveChangesAsync();
            return (true, "Post deleted.");
        }

        // ── HELPER: Map Post → PostDto ─────────────────────────────────
        private PostDto MapToDto(Post post, int currentUserId)
        {
            return new PostDto
            {
                Id = post.Id,
                Content = post.Content,
                ImageUrl = post.ImageUrl,
                VideoUrl = post.VideoUrl,
                Type = post.Type.ToString(),
                UserId = post.User.Id,
                Username = post.User.Username,
                FullName = post.User.FullName,
                ProfilePicture = post.User.ProfilePictureUrl,
                LikeCount = post.Likes?.Count ?? 0, // Inayos para iwas null error
                CommentCount = post.Comments?.Count ?? 0,
                IsLikedByMe = post.Likes?.Any(l => l.UserId == currentUserId) ?? false,
                CreatedAt = post.CreatedAt
            };
        }
    }
}