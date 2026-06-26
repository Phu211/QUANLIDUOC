using Microsoft.AspNetCore.SignalR;

namespace HisPharmacy.Api.Hubs;

public class PharmacyHub : Hub
{
    // Real-time broadcasts will be sent from Controllers/Services using IHubContext.
    // Clients connect here and listen to "NotifyUpdate" events.
}
