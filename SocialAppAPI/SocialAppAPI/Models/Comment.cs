namespace SocialAppAPI.Models
{
	// Represents a comment on a post
	public class Comment
	{
		public int Id { get; set; }

		public int PostId { get; set; }
		public Post Post { get; set; } = null!;

		public int UserId { get; set; }
		public User User { get; set; } = null!;

		public string Content { get; set; } = string.Empty; // Comment text

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	}
}