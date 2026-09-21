using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HisPharmacy.Api.Services
{
    public class GeminiAiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeminiAiService> _logger;

        private readonly string _apiKey;
        private readonly string _primaryModel;
        private readonly List<string> _fallbackModels;

        public GeminiAiService(HttpClient httpClient, IConfiguration configuration, ILogger<GeminiAiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;

            _apiKey = _configuration["Gemini:ApiKey"];
            if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY")
            {
                _apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? "";
            }
            _primaryModel = _configuration["Gemini:PrimaryModel"] ?? "gemini-3.5-flash-lite";
            
            var fallbacks = _configuration.GetSection("Gemini:FallbackModels").Get<List<string>>();
            _fallbackModels = fallbacks ?? new List<string> { "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.6-flash" };
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

        /// <summary>
        /// Gửi yêu cầu sinh văn bản đến Google Gemini (Generative Text)
        /// </summary>
        public async Task<string?> GenerateTextAsync(string userPrompt, string? systemInstruction = null)
        {
            if (!IsConfigured) return null;

            var modelsToTry = new List<string> { _primaryModel };
            modelsToTry.AddRange(_fallbackModels.Where(m => m != _primaryModel));

            foreach (var model in modelsToTry)
            {
                try
                {
                    var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";

                    var requestPayload = new
                    {
                        contents = new[]
                        {
                            new
                            {
                                parts = new object[]
                                {
                                    new { text = userPrompt }
                                }
                            }
                        },
                        systemInstruction = string.IsNullOrWhiteSpace(systemInstruction) ? null : new
                        {
                            parts = new[]
                            {
                                new { text = systemInstruction }
                            }
                        }
                    };

                    var jsonString = JsonSerializer.Serialize(requestPayload, new JsonSerializerOptions
                    {
                        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                    });

                    using var content = new StringContent(jsonString, Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(endpoint, content);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseJson = await response.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(responseJson);
                        
                        var root = doc.RootElement;
                        if (root.TryGetProperty("candidates", out var candidates) && 
                            candidates.GetArrayLength() > 0 &&
                            candidates[0].TryGetProperty("content", out var candidateContent) &&
                            candidateContent.TryGetProperty("parts", out var parts) &&
                            parts.GetArrayLength() > 0 &&
                            parts[0].TryGetProperty("text", out var textElem))
                        {
                            _logger.LogInformation("Gemini AI [{Model}] phản hồi thành công.", model);
                            return textElem.GetString();
                        }
                    }
                    else
                    {
                        var err = await response.Content.ReadAsStringAsync();
                        _logger.LogWarning("Gemini AI [{Model}] trả về mã lỗi {StatusCode}: {Error}", model, response.StatusCode, err);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi gọi Gemini AI với model {Model}", model);
                }
            }

            return null;
        }

        /// <summary>
        /// Gửi tài liệu/hình ảnh lên Gemini Multimodal Vision để bóc tách thông tin
        /// </summary>
        public async Task<string?> AnalyzeDocumentAsync(byte[] fileBytes, string mimeType, string prompt, string? systemInstruction = null)
        {
            if (!IsConfigured || fileBytes == null || fileBytes.Length == 0) return null;

            var base64Data = Convert.ToBase64String(fileBytes);
            var modelsToTry = new List<string> { _primaryModel };
            modelsToTry.AddRange(_fallbackModels.Where(m => m != _primaryModel));

            foreach (var model in modelsToTry)
            {
                try
                {
                    var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";

                    var requestPayload = new
                    {
                        contents = new[]
                        {
                            new
                            {
                                parts = new object[]
                                {
                                    new { text = prompt },
                                    new
                                    {
                                        inlineData = new
                                        {
                                            mimeType = mimeType,
                                            data = base64Data
                                        }
                                    }
                                }
                            }
                        },
                        systemInstruction = string.IsNullOrWhiteSpace(systemInstruction) ? null : new
                        {
                            parts = new[]
                            {
                                new { text = systemInstruction }
                            }
                        }
                    };

                    var jsonString = JsonSerializer.Serialize(requestPayload, new JsonSerializerOptions
                    {
                        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                    });

                    using var content = new StringContent(jsonString, Encoding.UTF8, "application/json");
                    var response = await _httpClient.PostAsync(endpoint, content);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseJson = await response.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(responseJson);

                        var root = doc.RootElement;
                        if (root.TryGetProperty("candidates", out var candidates) && 
                            candidates.GetArrayLength() > 0 &&
                            candidates[0].TryGetProperty("content", out var candidateContent) &&
                            candidateContent.TryGetProperty("parts", out var parts) &&
                            parts.GetArrayLength() > 0 &&
                            parts[0].TryGetProperty("text", out var textElem))
                        {
                            _logger.LogInformation("Gemini Vision AI [{Model}] xử lý ảnh/PDF thành công.", model);
                            return textElem.GetString();
                        }
                    }
                    else
                    {
                        var err = await response.Content.ReadAsStringAsync();
                        _logger.LogWarning("Gemini Vision [{Model}] trả về mã lỗi {StatusCode}: {Error}", model, response.StatusCode, err);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi gọi Gemini Vision AI với model {Model}", model);
                }
            }

            return null;
        }

        /// <summary>
        /// Tiện ích làm sạch JSON trả về từ LLM (bỏ các dấu ```json và ```)
        /// </summary>
        public static string CleanJsonFromMarkdown(string rawText)
        {
            if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;

            var text = rawText.Trim();

            // 1. Nếu có block ```json ... ```
            var match = System.Text.RegularExpressions.Regex.Match(text, @"```(?:json)?\s*([\s\S]*?)\s*```", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Groups[1].Value.Trim();
            }

            // 2. Nếu không có block, trích xuất từ ký tự '{' đầu tiên đến '}' cuối cùng
            var firstBrace = text.IndexOf('{');
            var lastBrace = text.LastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace)
            {
                return text.Substring(firstBrace, lastBrace - firstBrace + 1).Trim();
            }

            // 3. Hoặc từ '[' đầu tiên đến ']' cuối cùng (nếu trả về mảng)
            var firstBracket = text.IndexOf('[');
            var lastBracket = text.LastIndexOf(']');
            if (firstBracket >= 0 && lastBracket > firstBracket)
            {
                return text.Substring(firstBracket, lastBracket - firstBracket + 1).Trim();
            }

            return text;
        }
    }
}
