namespace SocialAppAPI.Models
{
    // Represents a post made by a user
    public class Post
    {
        public int Id { get; set; }

        // The user who created this post
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        public string? Content { get; set; }        // Text content (optional if has image)
        public string? ImageUrl { get; set; }       // Image URL (optional)
        public string? VideoUrl { get; set; }       // Video URL (optional)

        public PostType Type { get; set; } = PostType.Text; // text / image / video

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation properties (will be used in Step 5)
        public ICollection<Like> Likes { get; set; } = new List<Like>();
        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    }

    public enum PostType
    {
        Text = 0,
        Image = 1,
        Video = 2
    }
}