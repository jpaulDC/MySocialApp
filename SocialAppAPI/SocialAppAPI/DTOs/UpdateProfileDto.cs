namespace SocialAppAPI.DTOs
{
    // Data accepted when updating a user's profile
    public class UpdateProfileDto
    {
        public string? FullName { get; set; }  // Optional – update lang kung may value
        public string? Bio { get; set; }        // Short bio / description
    }
}