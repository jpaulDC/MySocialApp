using Microsoft.EntityFrameworkCore;
using SocialAppAPI.Data;
using SocialAppAPI.DTOs;
using SocialAppAPI.Models;

namespace SocialAppAPI.Services
{
    public class LikeCommentService
    {
        private readonly AppDbContext _context;

        public LikeCommentService(AppDbContext context)
        {
            _context = context;
        }

        // ══════════════════════════════════════════════════════════════
        //  LIKE SYSTEM
        // ══════════════════════════════════════════════════════════════

        // ── TOGGLE LIKE (Like if not liked, Unlike if already liked) ──
        public async Task<(bool Success, string Action, int LikeCount)> ToggleLikeAsync(
            int postId, int userId)
        {
            // Check if post exists
            var post = await _context.Posts
                .Include(p => p.Likes)
                .FirstOrDefaultAsync(p => p.Id == postId);

            if (post == null)
                return (false, "Post not found.", 0);

            // Check if current user already liked this post
            var existingLike = await _context.Likes
                .FirstOrDefaultAsync(l => l.PostId == postId && l.UserId == userId);

            string action;

            if (existingLike != null)
            {
                // Already liked → UNLIKE
                _context.Likes.Remove(existingLike);
                action = "unliked";
            }
            else
            {
                // Not yet liked → LIKE
                var like = new Like
                {
                    PostId = postId,
                    UserId = userId
                };
                _context.Likes.Add(like);
                action = "liked";
            }

            await _context.SaveChangesAsync();

            // Return updated like count
            var likeCount = await _context.Likes.CountAsync(l => l.PostId == postId);
            return (true, action, likeCount);
        }

        // ── GET USERS WHO LIKED A POST ─────────────────────────────────
        public async Task<List<UserProfileDto>> GetLikesAsync(int postId)
        {
            var likes = await _context.Likes
                .Include(l => l.User)
                .Where(l => l.PostId == postId)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync();

            return likes.Select(l => new UserProfileDto
            {
                Id = l.User.Id,
                Username = l.User.Username,
                FullName = l.User.FullName,
                ProfilePictureUrl = l.User.ProfilePictureUrl,
                CreatedAt = l.CreatedAt
            }).ToList();
        }

        // ══════════════════════════════════════════════════════════════
        //  COMMENT SYSTEM
        // ══════════════════════════════════════════════════════════════

        // ── ADD COMMENT ────────────────────────────────────────────────
        public async Task<(bool Success, string Message, CommentDto? Comment)> AddCommentAsync(
            int postId, int userId, AddCommentDto dto)
        {
            // Check if post exists
            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists)
                return (false, "Post not found.", null);

            // Create new comment
            var comment = new Comment
            {
                PostId = postId,
                UserId = userId,
                Content = dto.Content.Trim()
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            // Load user info for the response
            await _context.Entry(comment)
                .Reference(c => c.User)
                .LoadAsync();

            // Map to DTO
            var commentDto = MapToDto(comment, userId);
            return (true, "Comment added!", commentDto);
        }

        // ── GET ALL COMMENTS FOR A POST ────────────────────────────────
        public async Task<List<CommentDto>> GetCommentsAsync(int postId, int currentUserId)
        {
            // Check if post exists
            var postExists = await _context.Posts.AnyAsync(p => p.Id == postId);
            if (!postExists) return new List<CommentDto>();

            var comments = await _context.Comments
                .Include(c => c.User)
                .Where(c => c.PostId == postId)
                .OrderBy(c => c.CreatedAt) // Oldest first (like chat)
                .ToListAsync();

            return comments.Select(c => MapToDto(c, currentUserId)).ToList();
        }

        // ── DELETE COMMENT ─────────────────────────────────────────────
        public async Task<(bool Success, string Message)> DeleteCommentAsync(
            int commentId, int userId)
        {
            var comment = await _context.Comments
                .Include(c => c.Post)
                .FirstOrDefaultAsync(c => c.Id == commentId);

            if (comment == null)
                return (false, "Comment not found.");

            // Allow: comment owner OR post owner to delete a comment
            bool isCommentOwner = comment.UserId == userId;
            bool isPostOwner = comment.Post.UserId == userId;

            if (!isCommentOwner && !isPostOwner)
                return (false, "You cannot delete this comment.");

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();

            return (true, "Comment deleted.");
        }

        // ── HELPER: Map Comment → CommentDto ──────────────────────────
        private CommentDto MapToDto(Comment comment, int currentUserId)
        {
            return new CommentDto
            {
                Id = comment.Id,
                Content = comment.Content,
                PostId = comment.PostId,
                UserId = comment.User.Id,
                Username = comment.User.Username,
                FullName = comment.User.FullName,
                ProfilePicture = comment.User.ProfilePictureUrl,
                IsMyComment = comment.UserId == currentUserId,
                CreatedAt = comment.CreatedAt
            };
        }
    }
}