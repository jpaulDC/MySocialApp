using System.ComponentModel.DataAnnotations;

namespace SocialAppAPI.DTOs
{
    // Data needed to send a message
    public class SendMessageDto
    {
        [Required]
        public int ReceiverId { get; set; } // Who to send to

        [Required]
        [MinLength(1, ErrorMessage = "Message cannot be empty.")]
        [MaxLength(1000, ErrorMessage = "Message cannot exceed 1000 characters.")]
        public string Content { get; set; } = string.Empty;
    }
}