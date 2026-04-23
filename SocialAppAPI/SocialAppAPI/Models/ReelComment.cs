namespace SocialAppAPI.Models
{
	// Represents a comment on a Reel
	public class ReelComment
	{
		public int Id { get; set; }

		public int ReelId { get; set; }
		public Reel Reel { get; set; } = null!;

		public int UserId { get; set; }
		public User User { get; set; } = null!;

		public string Content { get; set; } = string.Empty;

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	}
}