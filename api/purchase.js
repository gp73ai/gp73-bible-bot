export const config = {
  runtime: 'nodejs',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const data = req.body;

    console.log('🔥 Incoming Purchase:', JSON.stringify(data));

    if (!data.email) {
      return res.status(400).json({ message: 'Missing email' });
    }

    // TEMP: log and return success — storage layer comes next
    return res.status(200).json({
      success: true,
      message: 'Purchase received',
      data
    });

  } catch (error) {
    console.error('❌ Error processing purchase:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}
