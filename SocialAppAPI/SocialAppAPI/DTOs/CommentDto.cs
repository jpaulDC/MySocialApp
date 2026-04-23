namespace SocialAppAPI.DTOs
{
    // Data returned when viewing a comment
    public class CommentDto
    {
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;

        // Who wrote the comment
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? ProfilePicture { get; set; }

        // Which post this comment belongs to
        public int PostId { get; set; }

        public bool IsMyComment { get; set; } // Can current user delete this?
        public DateTime CreatedAt { get; set; }
    }
}