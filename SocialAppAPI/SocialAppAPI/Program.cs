using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using SocialAppAPI.Hubs;      // Siguraduhin na tama ang namespace ng Hub mo
using SocialAppAPI.Data;
using SocialAppAPI.Services;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. DATABASE (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// 2. JWT AUTHENTICATION + SIGNALR TOKEN SUPPORT
var jwtKey = builder.Configuration["Jwt:Key"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        // ── BAGO: Allow SignalR to read JWT from query string ──
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                // Kung ang request ay papunta sa SignalR hub, basahin ang token mula sa URL
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/hubs/chat"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// 3. SERVICES (Pinagsama ang luma at bago)
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<FriendService>();
builder.Services.AddScoped<PostService>();
builder.Services.AddScoped<LikeCommentService>();
builder.Services.AddScoped<ReelService>();
builder.Services.AddScoped<ChatService>();           // ← BAGO: Para sa Chat logic
builder.Services.AddSignalR();                       // ← BAGO: Enable SignalR

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// SWAGGER CONFIG (Nandito lahat ng Security Definitions mo)
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "SocialApp API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Bear your JWT token sa text box."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// 4. CORS POLICY
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials() // ← MAHALAGA: Kailangan ito para sa SignalR
            .SetIsOriginAllowed(_ => true)); // Mas safe ito para sa mobile testing
});

var app = builder.Build();

// 5. SWAGGER UI
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SocialApp API V1");
    c.RoutePrefix = "swagger";
});

// 6. MIDDLEWARE PIPELINE
app.UseStaticFiles();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── BAGO: MAP SIGNALR HUB ────────────────────────────────────────────────────
app.MapHub<ChatHub>("/hubs/chat");

// 7. RUN WITH YOUR CUSTOM IP/PORT
app.Run("http://0.0.0.0:5261");