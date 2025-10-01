@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final BlobServiceClient blobServiceClient;

    @GetMapping
    public List<String> listFiles() {
        BlobContainerClient containerClient = blobServiceClient.getBlobContainerClient("my-container");
        List<String> files = new ArrayList<>();
        for (BlobItem blobItem : containerClient.listBlobs()) {
            files.add(blobItem.getName());
        }
        return files;
    }
}
