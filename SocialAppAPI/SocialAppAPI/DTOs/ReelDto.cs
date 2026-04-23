namespace SocialAppAPI.DTOs
{
    // Data returned when viewing a Reel
    public class ReelDto
    {
        public int Id { get; set; }
        public string VideoUrl { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
        public string? Caption { get; set; }
        public int Duration { get; set; }

        // Author info
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? ProfilePicture { get; set; }

        // Engagement
        public int LikeCount { get; set; }
        public int CommentCount { get; set; }
        public bool IsLikedByMe { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}