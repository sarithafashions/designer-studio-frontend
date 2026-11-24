import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicPdf } from '../utils/downloadPdf.js';
import Lottie from 'lottie-react';
import downloadingAnimation from '../Pages/assets/downloading.json';
import successAnimation from '../Pages/assets/success.json';
import './InvoiceDownload.css';

// Receipt download page; with kind="payment-receipts" it serves the payment receipt links too.
function InvoiceDownload({ kind = 'receipts', label = 'receipt', filePrefix = 'Receipt' }) {
    const { receiptId } = useParams();
    const [status, setStatus] = useState('downloading');
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    const closeWindow = () => {
        // Try to close the window
        if (window.opener || window.history.length === 1) {
            window.close();
        } else {
            // If we can't close, make the page blank and prevent any interaction
            document.body.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    text-align: center;
                    padding: 20px;
                ">
                    <h2>You may now safely close this tab</h2>
                    <p>The download is complete and no further action is required.</p>
                    <button onclick="window.close()" style="
                        padding: 10px 20px;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 20px;
                    ">
                        Close Tab
                    </button>
                    <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                        If the button doesn't work, please close this tab manually.
                    </p>
                </div>
            `;
            // Prevent any further navigation
            window.onbeforeunload = null;
            window.history.pushState(null, document.title, window.location.href);
            window.addEventListener('popstate', () => {
                window.history.pushState(null, document.title, window.location.href);
            });
        }
    };

    useEffect(() => {
        // Prevent back navigation
        window.history.pushState(null, document.title, window.location.href);
        window.addEventListener('popstate', function(event) {
            window.history.pushState(null, document.title, window.location.href);
        });

        const downloadInvoice = async () => {
            try {
                setStatus('downloading');

                // GET /v1/api/public/documents/{receipts|payment-receipts}/{token} -> the PDF itself (no login;
                // the route parameter is the signed link token)
                const blob = await fetchPublicPdf(kind, receiptId);

                // 4. Create download link
                const url = window.URL.createObjectURL(blob);
                setDownloadUrl(url);

                // Trigger download
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filePrefix}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Show success animation
                setStatus('success');
                // Auto-close after 5 seconds if user doesn't click
                setTimeout(closeWindow, 5000);

            } catch (error) {
                console.error('Download failed:', error);
                // e.g. "This download link is invalid or has expired"
                setErrorMessage(error.response?.data?.message || '');
                setStatus('error');
            }
        };

        downloadInvoice();
        // Just for deployemnt purpose only

        return () => {
            // Cleanup
            if (downloadUrl) {
                window.URL.revokeObjectURL(downloadUrl);
            }
        };
    }, [receiptId, kind]);

    const handleManualDownload = () => {
        if (downloadUrl) {
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `${filePrefix}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setStatus('success');
            setTimeout(closeWindow, 3000);
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'downloading':
                return (
                    <div className="animation-container">
                        <Lottie
                            animationData={downloadingAnimation}
                            loop={true}
                            style={{ height: 200 }}
                        />
                        <h2>Preparing your {label}...</h2>
                        <p>This will just take a moment</p>
                        <div className="progress-bar">
                            <div className="progress"></div>
                        </div>
                    </div>
                );

            case 'manual':
                return (
                    <div className="manual-download-container">
                        <div className="animation-container">
                            <Lottie
                                animationData={downloadingAnimation}
                                loop={false}
                                style={{ height: 150 }}
                            />
                        </div>
                        <h2>Click to download your {label}</h2>
                        <p>Your download didn't start automatically</p>
                        <button
                            onClick={handleManualDownload}
                            className="download-button"
                        >
                            <span className="button-icon">↓</span>
                            Download {label}
                        </button>
                        <p className="small-text">If download doesn't start, try long-pressing the button</p>
                    </div>
                );

            case 'success':
                return (
                    <div className="success-container">
                        <Lottie
                            animationData={successAnimation}
                            loop={false}
                            style={{ height: 200 }}
                        />
                        <h2>Download complete!</h2>
                        <p>Your {label} has been downloaded successfully</p>
                        <div className="success-checkmark">✓</div>
                        <button
                            onClick={closeWindow}
                            className="close-button"
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginTop: '20px'
                            }}
                        >
                            Close This Tab
                        </button>
                        <p className="small-text" style={{ marginTop: '10px' }}>
                            This tab will close automatically in 5 seconds
                        </p>
                    </div>
                );

            case 'error':
                return (
                    <div className="error-container">
                        <div className="error-icon">⚠️</div>
                        <h2>Download failed</h2>
                        <p>{errorMessage || `We couldn't download your ${label} at this time`}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="retry-button"
                        >
                            Try Again
                        </button>
                        <p className="support-text">
                            Still having trouble? <a href="/contact">Contact support</a>
                        </p>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="invoice-download-page">
            <div className="download-card">
                {renderContent()}
            </div>
        </div>
    );
}

export default InvoiceDownload;
