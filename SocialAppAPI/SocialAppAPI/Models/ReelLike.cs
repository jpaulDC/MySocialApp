namespace SocialAppAPI.Models
{
    // Represents a like on a Reel
    public class ReelLike
    {
        public int Id { get; set; }

        public int ReelId { get; set; }
        public Reel Reel { get; set; } = null!;

        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}