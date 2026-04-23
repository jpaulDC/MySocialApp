namespace SocialAppAPI.DTOs
{
    // Returned when listing friends or friend requests
    public class FriendDto
    {
        public int FriendshipId { get; set; }      // ID of the Friendship record
        public int UserId { get; set; }            // The other user's ID
        public string Username { get; set; } = string.Empty;
        public string? FullName { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string Status { get; set; } = string.Empty; // "Pending" / "Accepted"
        public bool IsRequester { get; set; }      // Did the current user send the request?
        public DateTime CreatedAt { get; set; }
    }
}