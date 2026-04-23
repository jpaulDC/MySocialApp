namespace SocialAppAPI.Models
{
    public class User
    {
        public int Id { get; set; }                          // Primary Key (auto-increment)
        public string Username { get; set; } = string.Empty; // Unique username
        public string Email { get; set; } = string.Empty;    // User email
        public string PasswordHash { get; set; } = string.Empty; // Hashed password (never store plain text!)
        public string? FullName { get; set; }                // Optional display name
        public string? ProfilePictureUrl { get; set; }       // Optional profile pic URL
        public string? Bio { get; set; }                     // Optional short bio
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow; // When the account was created
    }
}
