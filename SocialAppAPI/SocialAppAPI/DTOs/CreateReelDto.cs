namespace SocialAppAPI.DTOs
{
    // Data accepted when uploading a new Reel
    public class CreateReelDto
    {
        public IFormFile Video { get; set; } = null!; // Required video file
        public string? Caption { get; set; }          // Optional caption
    }
}