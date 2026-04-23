namespace SocialAppAPI.DTOs
{
    // Data returned when viewing a post
    public class PostDto
    {
        public int Id { get; set; }
        public string? Content { get; set; }
        public string? ImageUrl { get; set; }
        public string? VideoUrl { get; set; }
        public string Type { get; set; } = string.Empty; // "Text" / "Image" / "Video"

        // Who made the post
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? ProfilePicture { get; set; }

        // Engagement counts (used in Step 5)
        public int LikeCount { get; set; }
        public int CommentCount { get; set; }
        public bool IsLikedByMe { get; set; } // Did the current user like this post?

        public DateTime CreatedAt { get; set; }
    }
}