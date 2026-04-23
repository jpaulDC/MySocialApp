namespace SocialAppAPI.DTOs
{
    public class ReelCommentDto
    {
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public int ReelId { get; set; }
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? ProfilePicture { get; set; }
        public bool IsMyComment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}