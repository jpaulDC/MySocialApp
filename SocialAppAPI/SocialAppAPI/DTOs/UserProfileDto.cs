namespace SocialAppAPI.DTOs
{
    // Data returned when viewing a user's profile
    public class UserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public int PostCount { get; set; }      // ← DAGDAG
        public int FriendCount { get; set; }    // ← DAGDAG
        public int LikeCount { get; set; }
    }
}