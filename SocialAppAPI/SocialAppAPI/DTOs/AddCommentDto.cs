using System.ComponentModel.DataAnnotations;

namespace SocialAppAPI.DTOs
{
    // Data needed when adding a comment
    public class AddCommentDto
    {
        [Required]
        [MinLength(1, ErrorMessage = "Comment cannot be empty.")]
        [MaxLength(500, ErrorMessage = "Comment cannot exceed 500 characters.")]
        public string Content { get; set; } = string.Empty;
    }
}