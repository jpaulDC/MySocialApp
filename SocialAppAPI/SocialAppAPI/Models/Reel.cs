namespace SocialAppAPI.Models
{
    // Represents a short video (Reel) uploaded by a user
    public class Reel
    {
        public int Id { get; set; }

        // Owner of the reel
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string VideoUrl { get; set; } = string.Empty; // Path to video file
        public string? ThumbnailUrl { get; set; }                // Optional preview image
        public string? Caption { get; set; }                // Optional text caption
        public int Duration { get; set; }                // Duration in seconds

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation – reels can be liked and commented on
        public ICollection<ReelLike> Likes { get; set; } = new List<ReelLike>();
        public ICollection<ReelComment> Comments { get; set; } = new List<ReelComment>();
    }
}