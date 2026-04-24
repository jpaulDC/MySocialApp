namespace SocialAppAPI.Models
{
    // Represents a chat message between two users
    public class Message
    {
        public int Id { get; set; }

        // Who sent the message
        public int  SenderId { get; set; }
        public User Sender   { get; set; } = null!;

        // Who received the message
        public int  ReceiverId { get; set; }
        public User Receiver   { get; set; } = null!;

        public string Content { get; set; } = string.Empty; // Message text

        public bool IsRead { get; set; } = false; // Has receiver seen this?

        public DateTime SentAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; } // When was it read?
    }
}