using System.ComponentModel.DataAnnotations;

namespace SocialAppAPI.DTOs
{
    // Data accepted when creating a new post
    public class CreatePostDto
    {
        public string? Content { get; set; }  // Text (optional if has image/video)
        public IFormFile? Image { get; set; } // Optional image upload
    }
}