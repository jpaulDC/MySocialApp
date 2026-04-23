namespace SocialAppAPI.Models
{
    // Represents a friend request or friendship between two users
    public class Friendship
    {
        public int Id { get; set; }

        // The user who SENT the friend request
        public int RequesterId { get; set; }
        public User Requester { get; set; } = null!;

        // The user who RECEIVED the friend request
        public int AddresseeId { get; set; }
        public User Addressee { get; set; } = null!;

        // Status: Pending / Accepted / Rejected
        public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }

    // Enum for friendship status
    public enum FriendshipStatus
    {
        Pending = 0,   // Request sent, not yet accepted
        Accepted = 1,   // Both users are now friends
        Rejected = 2    // Request was declined
    }
}