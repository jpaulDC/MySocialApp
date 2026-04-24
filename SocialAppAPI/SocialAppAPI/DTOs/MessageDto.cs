namespace SocialAppAPI.DTOs
{
    // Returned when viewing a message
    public class MessageDto
    {
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public bool IsDelivered { get; set; }
        public DateTime SentAt { get; set; }
        public DateTime? ReadAt { get; set; }

        // Sender info
        public int SenderId { get; set; }
        public string SenderUsername { get; set; } = string.Empty;
        public string? SenderFullName { get; set; }
        public string? SenderPicture { get; set; }

        // Receiver info
        public int ReceiverId { get; set; }
        public string ReceiverUsername { get; set; } = string.Empty;
        public string? ReceiverFullName { get; set; }
        public string? ReceiverPicture { get; set; }

        public bool IsMyMessage { get; set; } // Did current user send this?
    }

    // Represents a conversation preview in the inbox list
    public class ConversationDto
    {
        public int OtherUserId { get; set; }
        public string OtherUsername { get; set; } = string.Empty;
        public string? OtherFullName { get; set; }
        public string? OtherPicture { get; set; }
        public string LastMessage { get; set; } = string.Empty;
        public DateTime LastMessageTime { get; set; }
        public int UnreadCount { get; set; } // Unread messages count
        public bool IsLastMessageMine { get; set; } // Did I send the last message?
    }
}